-- =====================================================================
-- 0009 - Fase 4: painel admin completo
--   * log de auditoria automático (posts, categorias, stories, destaques,
--     perfis de acesso, permissões, equipe, banimentos, moderação)
--   * proteção: não excluir perfil de acesso em uso
--   * RPCs de métricas do dashboard (exigem metrics.view)
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfil de acesso em uso não pode ser excluído
-- ---------------------------------------------------------------------
create or replace function public.roles_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  if old.is_system then
    raise exception 'Perfis de sistema não podem ser excluídos.' using errcode = '42501';
  end if;
  select count(*) into v_total from public.profiles where role_id = old.id;
  if v_total > 0 then
    raise exception 'Este perfil está em uso por % pessoa(s). Troque o perfil delas antes de excluir.', v_total
      using errcode = '23503';
  end if;
  return old;
end;
$$;

drop trigger if exists roles_before_delete on public.roles;
create trigger roles_before_delete
  before delete on public.roles
  for each row execute function public.roles_before_delete();

-- ---------------------------------------------------------------------
-- Auditoria genérica (posts, categorias, stories, destaques, roles)
-- ---------------------------------------------------------------------
create or replace function public.audit_generic()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_label_col text := tg_argv[1];
  v_row jsonb;
  v_old jsonb;
  v_action text;
  v_meta jsonb;
begin
  -- Mudanças apenas de contadores não entram no log
  if coalesce(current_setting('app.counter_update', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_row := to_jsonb(new);
    v_action := v_entity || '.create';
  elsif tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_action := v_entity || '.delete';
  else
    v_row := to_jsonb(new);
    v_old := to_jsonb(old);
    v_action := v_entity || '.update';
    -- post publicado/despublicado
    if v_entity = 'post' and (v_row ->> 'status') is distinct from (v_old ->> 'status') then
      v_action := case when v_row ->> 'status' = 'published' then 'post.publish' else 'post.unpublish' end;
    end if;
    -- ignora updates sem mudança real
    if (v_row - 'updated_at' - 'like_count' - 'comment_count' - 'view_count')
       = (v_old - 'updated_at' - 'like_count' - 'comment_count' - 'view_count') then
      return null;
    end if;
  end if;

  v_meta := jsonb_build_object('label', v_row ->> v_label_col);
  if v_entity = 'story' then
    v_meta := v_meta || jsonb_build_object('media_type', v_row ->> 'media_type', 'is_highlight', v_row -> 'is_highlight');
  end if;

  perform public.log_audit(v_action, v_entity, v_row ->> 'id', v_meta);
  return null;
end;
$$;

drop trigger if exists audit_posts on public.posts;
create trigger audit_posts after insert or update or delete on public.posts
  for each row execute function public.audit_generic('post', 'title');

drop trigger if exists audit_categories on public.categories;
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.audit_generic('category', 'name');

drop trigger if exists audit_stories on public.stories;
create trigger audit_stories after insert or update or delete on public.stories
  for each row execute function public.audit_generic('story', 'caption');

drop trigger if exists audit_highlights on public.highlights;
create trigger audit_highlights after insert or update or delete on public.highlights
  for each row execute function public.audit_generic('highlight', 'title');

drop trigger if exists audit_roles on public.roles;
create trigger audit_roles after insert or update or delete on public.roles
  for each row execute function public.audit_generic('role', 'name');

-- ---------------------------------------------------------------------
-- Permissões concedidas/removidas de um perfil
-- ---------------------------------------------------------------------
create or replace function public.audit_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
  v_role text;
  v_perm text;
begin
  if tg_op = 'INSERT' then v_rec := new; else v_rec := old; end if;
  select name into v_role from public.roles where id = v_rec.role_id;
  select key into v_perm from public.permissions where id = v_rec.permission_id;
  -- perfil sendo excluído: o log de role.delete já basta
  if v_role is null then
    return null;
  end if;
  perform public.log_audit(
    case when tg_op = 'INSERT' then 'role.grant_permission' else 'role.revoke_permission' end,
    'role', v_rec.role_id::text,
    jsonb_build_object('label', v_role, 'permission', v_perm)
  );
  return null;
end;
$$;

drop trigger if exists audit_role_permissions on public.role_permissions;
create trigger audit_role_permissions after insert or delete on public.role_permissions
  for each row execute function public.audit_role_permissions();

-- ---------------------------------------------------------------------
-- Equipe e banimentos (alterações em profiles)
-- ---------------------------------------------------------------------
create or replace function public.audit_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text := coalesce(new.full_name, new.username, new.email);
  v_old_role text;
  v_new_role text;
begin
  if new.is_banned and not old.is_banned then
    perform public.log_audit('user.ban', 'user', new.id::text,
      jsonb_build_object('label', v_label, 'reason', new.banned_reason));
  elsif old.is_banned and not new.is_banned then
    perform public.log_audit('user.unban', 'user', new.id::text, jsonb_build_object('label', v_label));
  end if;

  if new.is_staff and not old.is_staff then
    perform public.log_audit('staff.add', 'user', new.id::text, jsonb_build_object('label', v_label));
  elsif old.is_staff and not new.is_staff then
    perform public.log_audit('staff.remove', 'user', new.id::text, jsonb_build_object('label', v_label));
  end if;

  if new.is_active is distinct from old.is_active then
    perform public.log_audit(case when new.is_active then 'staff.activate' else 'staff.deactivate' end,
      'user', new.id::text, jsonb_build_object('label', v_label));
  end if;

  if new.role_id is distinct from old.role_id then
    select name into v_old_role from public.roles where id = old.role_id;
    select name into v_new_role from public.roles where id = new.role_id;
    perform public.log_audit('staff.change_role', 'user', new.id::text,
      jsonb_build_object('label', v_label, 'from', v_old_role, 'to', v_new_role));
  end if;

  return null;
end;
$$;

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after update on public.profiles
  for each row execute function public.audit_profiles();

-- ---------------------------------------------------------------------
-- Moderação: comentário apagado por outra pessoa que não o autor
-- ---------------------------------------------------------------------
create or replace function public.audit_comment_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() <> old.user_id then
    perform public.log_audit(
      case when tg_table_name = 'story_comments' then 'story_comment.delete' else 'comment.delete' end,
      'comment', old.id::text,
      jsonb_build_object('label', left(old.content, 120), 'author_id', old.user_id)
    );
  end if;
  return null;
end;
$$;

drop trigger if exists audit_comments_delete on public.comments;
create trigger audit_comments_delete after delete on public.comments
  for each row execute function public.audit_comment_delete();

drop trigger if exists audit_story_comments_delete on public.story_comments;
create trigger audit_story_comments_delete after delete on public.story_comments
  for each row execute function public.audit_comment_delete();

-- ---------------------------------------------------------------------
-- Métricas (todas exigem metrics.view)
-- ---------------------------------------------------------------------
create or replace function public.assert_permission(p_key text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission(p_key) then
    raise exception 'Sem permissão (%).', p_key using errcode = '42501';
  end if;
end;
$$;

-- Resumo geral
create or replace function public.admin_metrics_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('metrics.view');
  return jsonb_build_object(
    'total_users',      (select count(*) from public.profiles where not is_staff),
    'new_users_7d',     (select count(*) from public.profiles where not is_staff and created_at >= now() - interval '7 days'),
    'new_users_today',  (select count(*) from public.profiles where not is_staff and created_at >= date_trunc('day', now())),
    'banned_users',     (select count(*) from public.profiles where is_banned),
    'staff_members',    (select count(*) from public.profiles where is_staff),
    'published_posts',  (select count(*) from public.posts where status = 'published'),
    'draft_posts',      (select count(*) from public.posts where status = 'draft'),
    'total_likes',      (select count(*) from public.post_likes),
    'total_comments',   (select count(*) from public.comments) + (select count(*) from public.story_comments),
    'active_stories',   (select count(*) from public.stories where not is_highlight and expires_at > now()),
    'story_views_7d',   (select count(*) from public.story_views where viewed_at >= now() - interval '7 days')
  );
end;
$$;

-- Novos cadastros por dia (inclui dias sem cadastro com zero)
create or replace function public.admin_signups_per_day(p_days integer default 30)
returns table (day date, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('metrics.view');
  return query
    select d::date as day,
           (select count(*)::integer from public.profiles p
             where not p.is_staff
               and p.created_at >= d
               and p.created_at < d + interval '1 day') as total
    from generate_series(
      date_trunc('day', now()) - make_interval(days => least(greatest(p_days, 1), 365) - 1),
      date_trunc('day', now()),
      interval '1 day'
    ) d
    order by d;
end;
$$;

-- Posts mais curtidos ('likes') ou comentados ('comments')
create or replace function public.admin_top_posts(p_metric text default 'likes', p_limit integer default 5)
returns table (id uuid, title text, slug text, like_count integer, comment_count integer, published_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('metrics.view');
  return query
    select p.id, p.title, p.slug, p.like_count, p.comment_count, p.published_at
    from public.posts p
    where p.status = 'published'
    order by case when p_metric = 'comments' then p.comment_count else p.like_count end desc,
             p.published_at desc
    limit least(greatest(p_limit, 1), 50);
end;
$$;

-- Stories mais vistos
create or replace function public.admin_top_stories(p_limit integer default 5)
returns table (
  id uuid, media_type public.media_type, storage_path text, caption text,
  view_count integer, like_count integer, comment_count integer,
  is_highlight boolean, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('metrics.view');
  return query
    select s.id, s.media_type, s.storage_path, s.caption, s.view_count, s.like_count,
           s.comment_count, s.is_highlight, s.created_at
    from public.stories s
    order by s.view_count desc, s.created_at desc
    limit least(greatest(p_limit, 1), 50);
end;
$$;

-- Atividade recente (cadastros, curtidas, comentários)
create or replace function public.admin_recent_activity(p_limit integer default 20)
returns table (
  kind text, actor_id uuid, actor_name text, actor_username text,
  target_title text, target_slug text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(p_limit, 1), 100);
begin
  perform public.assert_permission('metrics.view');
  return query
    select * from (
      (select 'signup'::text, p.id, p.full_name, p.username, null::text, null::text, p.created_at
         from public.profiles p order by p.created_at desc limit v_limit)
      union all
      (select 'post_like'::text, l.user_id, pr.full_name, pr.username, po.title, po.slug, l.created_at
         from public.post_likes l
         join public.profiles pr on pr.id = l.user_id
         join public.posts po on po.id = l.post_id
         order by l.created_at desc limit v_limit)
      union all
      (select 'post_comment'::text, c.user_id, pr.full_name, pr.username, po.title, po.slug, c.created_at
         from public.comments c
         join public.profiles pr on pr.id = c.user_id
         join public.posts po on po.id = c.post_id
         order by c.created_at desc limit v_limit)
      union all
      (select 'story_comment'::text, sc.user_id, pr.full_name, pr.username, s.caption, null::text, sc.created_at
         from public.story_comments sc
         join public.profiles pr on pr.id = sc.user_id
         join public.stories s on s.id = sc.story_id
         order by sc.created_at desc limit v_limit)
    ) a (kind, actor_id, actor_name, actor_username, target_title, target_slug, created_at)
    order by a.created_at desc
    limit v_limit;
end;
$$;

grant execute on function public.admin_metrics_summary() to authenticated;
grant execute on function public.admin_signups_per_day(integer) to authenticated;
grant execute on function public.admin_top_posts(text, integer) to authenticated;
grant execute on function public.admin_top_stories(integer) to authenticated;
grant execute on function public.admin_recent_activity(integer) to authenticated;
revoke execute on function public.admin_metrics_summary() from anon;
revoke execute on function public.admin_signups_per_day(integer) from anon;
revoke execute on function public.admin_top_posts(text, integer) from anon;
revoke execute on function public.admin_top_stories(integer) from anon;
revoke execute on function public.admin_recent_activity(integer) from anon;

revoke execute on function public.roles_before_delete() from public, anon, authenticated;
revoke execute on function public.audit_generic() from public, anon, authenticated;
revoke execute on function public.audit_role_permissions() from public, anon, authenticated;
revoke execute on function public.audit_profiles() from public, anon, authenticated;
revoke execute on function public.audit_comment_delete() from public, anon, authenticated;
