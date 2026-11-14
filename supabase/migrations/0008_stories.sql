-- =====================================================================
-- 0008 - Fase 3: stories, destaques, reações e visualizações
--   * guarda de stories (24 h no servidor; destaque sem expiração)
--   * excluir destaque não apaga os stories: eles viram "expirados"
--   * contadores (likes, comentários, views) + notificações
--   * register_story_view: view sem duplicar (logado ou session_id)
--   * get_story_viewers: lista de quem viu (stories.view_stats)
--   * story_reaction_counts: contagem de reações por emoji
--   * expired_stories_for_cleanup: usada pela Edge Function de limpeza
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guarda de stories
-- ---------------------------------------------------------------------
create or replace function public.stories_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counter boolean := coalesce(current_setting('app.counter_update', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    new.view_count := 0;
    new.like_count := 0;
    new.comment_count := 0;
    new.created_at := now();
    if new.is_highlight then
      new.expires_at := null;
    else
      -- validade sempre definida pelo servidor: 24 horas
      new.highlight_id := null;
      new.expires_at := now() + interval '24 hours';
    end if;
    return new;
  end if;

  -- UPDATE
  new.created_at := old.created_at;
  new.media_type := old.media_type;
  new.storage_path := old.storage_path;
  if not v_counter then
    new.view_count := old.view_count;
    new.like_count := old.like_count;
    new.comment_count := old.comment_count;
  end if;
  if new.author_id is distinct from old.author_id and new.author_id is not null then
    raise exception 'O autor do story não pode ser alterado.' using errcode = '42501';
  end if;

  if new.is_highlight then
    new.expires_at := null;
  elsif old.is_highlight and not new.is_highlight then
    -- saiu do destaque: passa a contar como expirado
    new.highlight_id := null;
    new.expires_at := least(old.created_at + interval '24 hours', now());
  else
    new.expires_at := old.expires_at;
  end if;

  return new;
end;
$$;

drop trigger if exists stories_guard on public.stories;
create trigger stories_guard
  before insert or update on public.stories
  for each row execute function public.stories_guard();

-- Excluir um destaque: os stories dele deixam de ser destaque (expirados)
create or replace function public.highlights_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.stories
     set is_highlight = false
   where highlight_id = old.id;
  return old;
end;
$$;

drop trigger if exists highlights_before_delete on public.highlights;
create trigger highlights_before_delete
  before delete on public.highlights
  for each row execute function public.highlights_before_delete();

-- ---------------------------------------------------------------------
-- Curtidas de story: contador + notificação
-- ---------------------------------------------------------------------
create or replace function public.story_likes_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  perform set_config('app.counter_update', 'on', true);
  if tg_op = 'INSERT' then
    update public.stories set like_count = like_count + 1
      where id = new.story_id returning author_id into v_author;
    if v_author is not null and v_author <> new.user_id then
      insert into public.notifications (user_id, type, actor_id, story_id)
      values (v_author, 'story_like', new.user_id, new.story_id);
    end if;
  else
    update public.stories set like_count = greatest(like_count - 1, 0) where id = old.story_id;
    delete from public.notifications
      where type = 'story_like' and actor_id = old.user_id and story_id = old.story_id;
  end if;
  perform set_config('app.counter_update', 'off', true);
  return null;
end;
$$;

drop trigger if exists story_likes_after_change on public.story_likes;
create trigger story_likes_after_change
  after insert or delete on public.story_likes
  for each row execute function public.story_likes_after_change();

-- ---------------------------------------------------------------------
-- Reações: notificação (uma por emoji; removida ao desfazer)
-- ---------------------------------------------------------------------
create or replace function public.story_reactions_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    select s.author_id into v_author from public.stories s where s.id = new.story_id;
    if v_author is not null and v_author <> new.user_id then
      -- evita várias notificações do mesmo usuário no mesmo story
      delete from public.notifications
        where type = 'story_reaction' and actor_id = new.user_id and story_id = new.story_id;
      insert into public.notifications (user_id, type, actor_id, story_id)
      values (v_author, 'story_reaction', new.user_id, new.story_id);
    end if;
  else
    if not exists (
      select 1 from public.story_reactions r where r.story_id = old.story_id and r.user_id = old.user_id
    ) then
      delete from public.notifications
        where type = 'story_reaction' and actor_id = old.user_id and story_id = old.story_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists story_reactions_after_change on public.story_reactions;
create trigger story_reactions_after_change
  after insert or delete on public.story_reactions
  for each row execute function public.story_reactions_after_change();

-- ---------------------------------------------------------------------
-- Comentários de story: 1 nível, contador e notificações
-- ---------------------------------------------------------------------
create or replace function public.story_comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story uuid;
  v_grandparent uuid;
begin
  new.content := trim(new.content);
  new.created_at := now();
  if new.parent_id is not null then
    select c.story_id, c.parent_id into v_story, v_grandparent
      from public.story_comments c where c.id = new.parent_id;
    if not found or v_story <> new.story_id then
      raise exception 'Comentário de origem inválido.' using errcode = '22023';
    end if;
    if v_grandparent is not null then
      new.parent_id := v_grandparent;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists story_comments_before_insert on public.story_comments;
create trigger story_comments_before_insert
  before insert on public.story_comments
  for each row execute function public.story_comments_before_insert();

create or replace function public.story_comments_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_parent_author uuid;
begin
  perform set_config('app.counter_update', 'on', true);
  if tg_op = 'INSERT' then
    update public.stories set comment_count = comment_count + 1
      where id = new.story_id returning author_id into v_author;

    if new.parent_id is not null then
      select c.user_id into v_parent_author from public.story_comments c where c.id = new.parent_id;
      if v_parent_author is not null and v_parent_author <> new.user_id then
        insert into public.notifications (user_id, type, actor_id, story_id, story_comment_id)
        values (v_parent_author, 'story_reply', new.user_id, new.story_id, new.id);
      end if;
    end if;

    if v_author is not null and v_author <> new.user_id and v_author is distinct from v_parent_author then
      insert into public.notifications (user_id, type, actor_id, story_id, story_comment_id)
      values (v_author, 'story_comment', new.user_id, new.story_id, new.id);
    end if;
  else
    update public.stories set comment_count = greatest(comment_count - 1, 0) where id = old.story_id;
  end if;
  perform set_config('app.counter_update', 'off', true);
  return null;
end;
$$;

drop trigger if exists story_comments_after_change on public.story_comments;
create trigger story_comments_after_change
  after insert or delete on public.story_comments
  for each row execute function public.story_comments_after_change();

-- ---------------------------------------------------------------------
-- Registro de visualização (sem duplicar)
-- Logado: 1 por usuário. Visitante: 1 por session_id anônimo.
-- Retorna true se a view foi contada agora.
-- ---------------------------------------------------------------------
create or replace function public.register_story_view(p_story_id uuid, p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
begin
  if p_session_id is null or char_length(p_session_id) not between 8 and 64 then
    raise exception 'Sessão inválida.' using errcode = '22023';
  end if;
  if not public.is_story_active(p_story_id) then
    return false;
  end if;

  if v_uid is not null and exists (select 1 from public.profiles where id = v_uid) then
    insert into public.story_views (story_id, viewer_id, session_id)
    values (p_story_id, v_uid, p_session_id)
    on conflict (story_id, viewer_id) where viewer_id is not null do nothing;
  else
    insert into public.story_views (story_id, viewer_id, session_id)
    values (p_story_id, null, p_session_id)
    on conflict (story_id, session_id) where viewer_id is null do nothing;
  end if;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    perform set_config('app.counter_update', 'on', true);
    update public.stories set view_count = view_count + 1 where id = p_story_id;
    perform set_config('app.counter_update', 'off', true);
  end if;

  return v_inserted > 0;
end;
$$;

grant execute on function public.register_story_view(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Quem viu (somente stories.view_stats)
-- ---------------------------------------------------------------------
create or replace function public.get_story_viewers(p_story_id uuid)
returns table (
  viewer_id uuid,
  full_name text,
  username text,
  avatar_url text,
  viewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('stories.view_stats') then
    raise exception 'Sem permissão para ver estatísticas.' using errcode = '42501';
  end if;
  return query
    select v.viewer_id, p.full_name, p.username, p.avatar_url, v.viewed_at
    from public.story_views v
    join public.profiles p on p.id = v.viewer_id
    where v.story_id = p_story_id
    order by v.viewed_at desc
    limit 500;
end;
$$;

-- Estatísticas resumidas de um story (views logadas x anônimas, reações)
create or replace function public.get_story_stats(p_story_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('stories.view_stats') then
    raise exception 'Sem permissão para ver estatísticas.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'views', s.view_count,
    'logged_views', (select count(*) from public.story_views v where v.story_id = s.id and v.viewer_id is not null),
    'anonymous_views', (select count(*) from public.story_views v where v.story_id = s.id and v.viewer_id is null),
    'likes', s.like_count,
    'comments', s.comment_count,
    'reactions', coalesce((
      select jsonb_object_agg(x.emoji, x.total)
      from (select r.emoji, count(*) as total from public.story_reactions r where r.story_id = s.id group by r.emoji) x
    ), '{}'::jsonb)
  ) into v_result
  from public.stories s where s.id = p_story_id;
  return v_result;
end;
$$;

grant execute on function public.get_story_viewers(uuid) to authenticated;
grant execute on function public.get_story_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Contagem pública de reações por emoji (sem expor quem reagiu).
-- View sem security_invoker de propósito; filtra stories ativos.
-- ---------------------------------------------------------------------
create or replace view public.story_reaction_counts
with (security_invoker = false) as
  select r.story_id, r.emoji, count(*)::integer as total
  from public.story_reactions r
  join public.stories s on s.id = r.story_id
  where s.is_highlight or s.expires_at > now()
  group by r.story_id, r.emoji;

grant select on public.story_reaction_counts to anon, authenticated;

-- ---------------------------------------------------------------------
-- Limpeza: stories expirados (não destaque) há mais de N dias.
-- A Edge Function "cleanup-stories" chama esta lista, apaga os arquivos
-- pela Storage API e depois apaga as linhas (com service role).
-- ---------------------------------------------------------------------
create or replace function public.expired_stories_for_cleanup(p_retention_days integer default 30)
returns table (id uuid, storage_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.storage_path
  from public.stories s
  where not s.is_highlight
    and s.expires_at < now() - make_interval(days => greatest(p_retention_days, 0))
  order by s.expires_at
  limit 500;
$$;

-- Somente a service role (Edge Function) usa a limpeza
revoke execute on function public.expired_stories_for_cleanup(integer) from public, anon, authenticated;

revoke execute on function public.stories_guard() from public, anon, authenticated;
revoke execute on function public.highlights_before_delete() from public, anon, authenticated;
revoke execute on function public.story_likes_after_change() from public, anon, authenticated;
revoke execute on function public.story_reactions_after_change() from public, anon, authenticated;
revoke execute on function public.story_comments_before_insert() from public, anon, authenticated;
revoke execute on function public.story_comments_after_change() from public, anon, authenticated;

-- Realtime de stories (contadores no visualizador)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stories') then
      alter publication supabase_realtime add table public.stories;
    end if;
  end if;
end $$;

-- =====================================================================
-- AGENDAMENTO DA LIMPEZA (opcional, rode depois de publicar a Edge
-- Function "cleanup-stories"). Requer as extensões pg_cron e pg_net
-- (Database > Extensions). Troque <PROJECT_REF> e <CRON_SECRET>.
--
--   select cron.schedule(
--     'cleanup-stories-diario',
--     '0 4 * * *',
--     $cron$
--       select net.http_post(
--         url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-stories',
--         headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
--         body := '{}'::jsonb
--       );
--     $cron$
--   );
-- =====================================================================
