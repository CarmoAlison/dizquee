-- =====================================================================
-- 0007 - Fase 2: posts, curtidas, comentários e notificações
--   * guarda de posts (publicação exige posts.publish, autor imutável,
--     contadores protegidos, updated_at só quando o conteúdo muda)
--   * contadores like_count/comment_count mantidos por trigger
--   * respostas limitadas a 1 nível
--   * notificações (curtida, comentário, resposta)
--   * RPC do feed com paginação por cursor
--   * Realtime em posts (contadores) e notifications
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guarda de posts
-- ---------------------------------------------------------------------
create or replace function public.posts_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_counter boolean := coalesce(current_setting('app.counter_update', true), '') = 'on';
begin
  new.slug := lower(new.slug);

  if tg_op = 'INSERT' then
    new.like_count := 0;
    new.comment_count := 0;
    new.created_at := now();
    new.updated_at := now();
    if new.status = 'published' then
      if v_uid is not null and not public.has_permission('posts.publish') then
        raise exception 'Sem permissão para publicar posts.' using errcode = '42501';
      end if;
      new.published_at := coalesce(new.published_at, now());
    end if;
    return new;
  end if;

  -- UPDATE
  new.created_at := old.created_at;

  if not v_counter then
    new.like_count := old.like_count;
    new.comment_count := old.comment_count;
  end if;

  if v_uid is not null then
    -- autor não muda (exceto ficar nulo quando a conta do autor é excluída)
    if new.author_id is distinct from old.author_id and new.author_id is not null then
      raise exception 'O autor do post não pode ser alterado.' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not public.has_permission('posts.publish') then
      raise exception 'Sem permissão para publicar/despublicar posts.' using errcode = '42501';
    end if;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if (new.title, new.slug, new.content, new.status, new.published_at)
     is distinct from (old.title, old.slug, old.content, old.status, old.published_at) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_guard on public.posts;
create trigger posts_guard
  before insert or update on public.posts
  for each row execute function public.posts_guard();

-- ---------------------------------------------------------------------
-- Contador de curtidas + notificação de curtida
-- ---------------------------------------------------------------------
create or replace function public.post_likes_after_change()
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
    update public.posts set like_count = like_count + 1
      where id = new.post_id
      returning author_id into v_author;

    if v_author is not null and v_author <> new.user_id then
      insert into public.notifications (user_id, type, actor_id, post_id)
      values (v_author, 'post_like', new.user_id, new.post_id);
    end if;
  else
    update public.posts set like_count = greatest(like_count - 1, 0)
      where id = old.post_id;
    -- descurtiu: some a notificação correspondente (evita spam)
    delete from public.notifications
      where type = 'post_like' and actor_id = old.user_id and post_id = old.post_id;
  end if;

  perform set_config('app.counter_update', 'off', true);
  return null;
end;
$$;

drop trigger if exists post_likes_after_change on public.post_likes;
create trigger post_likes_after_change
  after insert or delete on public.post_likes
  for each row execute function public.post_likes_after_change();

-- ---------------------------------------------------------------------
-- Comentários: 1 nível de resposta, conteúdo limpo, data do servidor
-- ---------------------------------------------------------------------
create or replace function public.comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post uuid;
  v_grandparent uuid;
begin
  new.content := trim(new.content);
  new.created_at := now();

  if new.parent_id is not null then
    select c.post_id, c.parent_id into v_post, v_grandparent
      from public.comments c where c.id = new.parent_id;
    if not found or v_post <> new.post_id then
      raise exception 'Comentário de origem inválido.' using errcode = '22023';
    end if;
    -- resposta de resposta vira resposta do comentário raiz (1 nível)
    if v_grandparent is not null then
      new.parent_id := v_grandparent;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_before_insert on public.comments;
create trigger comments_before_insert
  before insert on public.comments
  for each row execute function public.comments_before_insert();

-- Contador de comentários + notificações (comentário e resposta)
create or replace function public.comments_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author uuid;
  v_parent_author uuid;
begin
  perform set_config('app.counter_update', 'on', true);

  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1
      where id = new.post_id
      returning author_id into v_post_author;

    if new.parent_id is not null then
      select c.user_id into v_parent_author from public.comments c where c.id = new.parent_id;
      if v_parent_author is not null and v_parent_author <> new.user_id then
        insert into public.notifications (user_id, type, actor_id, post_id, comment_id)
        values (v_parent_author, 'comment_reply', new.user_id, new.post_id, new.id);
      end if;
    end if;

    if v_post_author is not null
       and v_post_author <> new.user_id
       and v_post_author is distinct from v_parent_author then
      insert into public.notifications (user_id, type, actor_id, post_id, comment_id)
      values (v_post_author, 'post_comment', new.user_id, new.post_id, new.id);
    end if;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0)
      where id = old.post_id;
  end if;

  perform set_config('app.counter_update', 'off', true);
  return null;
end;
$$;

drop trigger if exists comments_after_change on public.comments;
create trigger comments_after_change
  after insert or delete on public.comments
  for each row execute function public.comments_after_change();

-- ---------------------------------------------------------------------
-- Feed com paginação por cursor (published_at, id)
-- SECURITY INVOKER: a RLS de posts continua valendo.
-- O front chama via supabase.rpc('get_feed').select('*, post_media(*), ...')
-- ---------------------------------------------------------------------
create or replace function public.get_feed(
  p_category_id uuid default null,
  p_before_published timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 10
)
returns setof public.posts
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.posts p
  where p.status = 'published'
    and p.published_at <= now()
    and (
      p_category_id is null
      or exists (
        select 1 from public.post_categories pc
        where pc.post_id = p.id and pc.category_id = p_category_id
      )
    )
    and (
      p_before_published is null
      or (p.published_at, p.id) < (p_before_published, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by p.published_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

grant execute on function public.get_feed(uuid, timestamptz, uuid, integer) to anon, authenticated;

-- Funções de trigger não são chamáveis via API
revoke execute on function public.posts_guard() from public, anon, authenticated;
revoke execute on function public.post_likes_after_change() from public, anon, authenticated;
revoke execute on function public.comments_before_insert() from public, anon, authenticated;
revoke execute on function public.comments_after_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime: contadores de posts e notificações
-- (a RLS continua valendo para o que cada cliente recebe)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts') then
      alter publication supabase_realtime add table public.posts;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;
