-- =====================================================================
-- 0004 - Row Level Security (RLS) de TODAS as tabelas
-- Regra geral:
--   * leitura pública só do que é público (posts publicados, categorias,
--     stories ativos/destaques, destaques, comentários de posts visíveis);
--   * interações (curtir, comentar, reagir) só por usuário logado, não
--     banido, e sempre em nome de si mesmo (auth.uid() = user_id);
--   * ações administrativas sempre com has_permission('...').
-- Idempotente (drop policy if exists + create policy).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares de policy
-- ---------------------------------------------------------------------

-- Pode editar o post? (editar qualquer / editar o próprio /
-- autor com posts.create enquanto o post for rascunho)
create or replace function public.can_edit_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('posts.edit_any')
      or exists (
        select 1 from public.posts p
        where p.id = p_post_id
          and p.author_id = auth.uid()
          and (
            public.has_permission('posts.edit_own')
            or (public.has_permission('posts.create') and p.status = 'draft')
          )
      );
$$;

-- Post visível para o público (publicado e com data já alcançada)
create or replace function public.is_post_public(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.status = 'published' and p.published_at <= now()
  );
$$;

-- Story ativo (não expirado ou destaque)
create or replace function public.is_story_active(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stories s
    where s.id = p_story_id and (s.is_highlight or s.expires_at > now())
  );
$$;

-- Pode ver stories inativos/estatísticas no admin?
create or replace function public.can_manage_stories()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_permission(array[
    'stories.create', 'stories.delete_own', 'stories.delete_any',
    'stories.manage_highlights', 'stories.view_stats'
  ]);
$$;

grant execute on function public.can_edit_post(uuid) to anon, authenticated;
grant execute on function public.is_post_public(uuid) to anon, authenticated;
grant execute on function public.is_story_active(uuid) to anon, authenticated;
grant execute on function public.can_manage_stories() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Habilita RLS em todas as tabelas
-- ---------------------------------------------------------------------
alter table public.roles              enable row level security;
alter table public.permissions        enable row level security;
alter table public.role_permissions   enable row level security;
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.posts              enable row level security;
alter table public.post_categories    enable row level security;
alter table public.post_media         enable row level security;
alter table public.post_likes         enable row level security;
alter table public.comments           enable row level security;
alter table public.highlights         enable row level security;
alter table public.stories            enable row level security;
alter table public.story_views        enable row level security;
alter table public.story_likes        enable row level security;
alter table public.story_reactions    enable row level security;
alter table public.story_comments     enable row level security;
alter table public.notifications      enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.push_subscriptions enable row level security;

-- ---------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select to authenticated
  using (
    public.has_any_permission(array['roles.view', 'roles.manage', 'staff.create', 'staff.edit'])
    or id = (select p.role_id from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists roles_insert on public.roles;
create policy roles_insert on public.roles for insert to authenticated
  with check (public.has_permission('roles.manage') and not is_system);

drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles for update to authenticated
  using (public.has_permission('roles.manage') and not is_system)
  with check (public.has_permission('roles.manage') and not is_system);

drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles for delete to authenticated
  using (public.has_permission('roles.manage') and not is_system);

-- ---------------------------------------------------------------------
-- permissions (somente leitura; criadas apenas por migração)
-- ---------------------------------------------------------------------
drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions for select to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- role_permissions
-- Ninguém concede uma permissão que não possui (evita escalada).
-- ---------------------------------------------------------------------
drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (
    public.has_any_permission(array['roles.view', 'roles.manage'])
    or role_id = (select p.role_id from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists role_permissions_insert on public.role_permissions;
create policy role_permissions_insert on public.role_permissions for insert to authenticated
  with check (
    public.has_permission('roles.manage')
    and not exists (select 1 from public.roles r where r.id = role_id and r.is_system)
    and public.has_permission((select perm.key from public.permissions perm where perm.id = permission_id))
  );

drop policy if exists role_permissions_delete on public.role_permissions;
create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using (
    public.has_permission('roles.manage')
    and not exists (select 1 from public.roles r where r.id = role_id and r.is_system)
  );

-- ---------------------------------------------------------------------
-- profiles
-- Leitura: o próprio perfil ou staff com permissão. (Dados públicos de
-- outras pessoas: view public_profiles.)
-- Alteração: o próprio (não banido) ou staff com permissão; o trigger
-- profiles_guard bloqueia campos sensíveis.
-- Inserção: somente pelo trigger de auth.users. Exclusão: delete_my_account().
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.has_any_permission(array['users.view', 'staff.create', 'staff.edit', 'staff.delete'])
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (
    (id = (select auth.uid()) and public.is_active_user())
    or public.has_any_permission(array['users.ban', 'users.unban', 'staff.edit', 'staff.delete'])
  )
  with check (
    (id = (select auth.uid()) and public.is_active_user())
    or public.has_any_permission(array['users.ban', 'users.unban', 'staff.edit', 'staff.delete'])
  );

-- ---------------------------------------------------------------------
-- categories (leitura pública)
-- ---------------------------------------------------------------------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to anon, authenticated
  using (true);

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories for insert to authenticated
  with check (public.has_permission('categories.create'));

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories for update to authenticated
  using (public.has_permission('categories.edit'))
  with check (public.has_permission('categories.edit'));

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories for delete to authenticated
  using (public.has_permission('categories.delete'));

-- ---------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to anon, authenticated
  using (
    (status = 'published' and published_at <= now())
    or author_id = (select auth.uid())
    or public.has_permission('posts.view_admin')
  );

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated
  with check (
    public.has_permission('posts.create')
    and author_id = (select auth.uid())
  );

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (public.can_edit_post(id))
  with check (public.can_edit_post(id));

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated
  using (
    public.has_permission('posts.delete_any')
    or (author_id = (select auth.uid()) and public.has_permission('posts.delete_own'))
  );

-- ---------------------------------------------------------------------
-- post_categories / post_media (seguem a visibilidade do post)
-- ---------------------------------------------------------------------
drop policy if exists post_categories_select on public.post_categories;
create policy post_categories_select on public.post_categories for select to anon, authenticated
  using (public.is_post_public(post_id) or public.has_permission('posts.view_admin') or public.can_edit_post(post_id));

drop policy if exists post_categories_insert on public.post_categories;
create policy post_categories_insert on public.post_categories for insert to authenticated
  with check (public.can_edit_post(post_id));

drop policy if exists post_categories_delete on public.post_categories;
create policy post_categories_delete on public.post_categories for delete to authenticated
  using (public.can_edit_post(post_id));

drop policy if exists post_media_select on public.post_media;
create policy post_media_select on public.post_media for select to anon, authenticated
  using (public.is_post_public(post_id) or public.has_permission('posts.view_admin') or public.can_edit_post(post_id));

drop policy if exists post_media_insert on public.post_media;
create policy post_media_insert on public.post_media for insert to authenticated
  with check (public.can_edit_post(post_id));

drop policy if exists post_media_update on public.post_media;
create policy post_media_update on public.post_media for update to authenticated
  using (public.can_edit_post(post_id))
  with check (public.can_edit_post(post_id));

drop policy if exists post_media_delete on public.post_media;
create policy post_media_delete on public.post_media for delete to authenticated
  using (public.can_edit_post(post_id));

-- ---------------------------------------------------------------------
-- post_likes
-- O público vê o CONTADOR (posts.like_count). As linhas (quem curtiu)
-- são visíveis só para a própria pessoa e para quem vê histórico.
-- ---------------------------------------------------------------------
drop policy if exists post_likes_select on public.post_likes;
create policy post_likes_select on public.post_likes for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('users.view_history'));

drop policy if exists post_likes_insert on public.post_likes;
create policy post_likes_insert on public.post_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_user()
    and public.is_post_public(post_id)
  );

drop policy if exists post_likes_delete on public.post_likes;
create policy post_likes_delete on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user());

-- ---------------------------------------------------------------------
-- comments (sem moderação prévia; sem edição)
-- ---------------------------------------------------------------------
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to anon, authenticated
  using (
    public.is_post_public(post_id)
    or public.has_any_permission(array['posts.view_admin', 'comments.delete_any', 'users.view_history'])
  );

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_user()
    and public.is_post_public(post_id)
  );

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('comments.delete_any'));

-- ---------------------------------------------------------------------
-- highlights (leitura pública)
-- ---------------------------------------------------------------------
drop policy if exists highlights_select on public.highlights;
create policy highlights_select on public.highlights for select to anon, authenticated
  using (true);

drop policy if exists highlights_insert on public.highlights;
create policy highlights_insert on public.highlights for insert to authenticated
  with check (public.has_permission('stories.manage_highlights'));

drop policy if exists highlights_update on public.highlights;
create policy highlights_update on public.highlights for update to authenticated
  using (public.has_permission('stories.manage_highlights'))
  with check (public.has_permission('stories.manage_highlights'));

drop policy if exists highlights_delete on public.highlights;
create policy highlights_delete on public.highlights for delete to authenticated
  using (public.has_permission('stories.manage_highlights'));

-- ---------------------------------------------------------------------
-- stories (público vê apenas ativos: não expirados ou destaques)
-- ---------------------------------------------------------------------
drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories for select to anon, authenticated
  using (is_highlight or expires_at > now() or public.can_manage_stories());

drop policy if exists stories_insert on public.stories;
create policy stories_insert on public.stories for insert to authenticated
  with check (
    public.has_permission('stories.create')
    and author_id = (select auth.uid())
    and (not is_highlight or public.has_permission('stories.manage_highlights'))
  );

drop policy if exists stories_update on public.stories;
create policy stories_update on public.stories for update to authenticated
  using (
    public.has_permission('stories.manage_highlights')
    or (author_id = (select auth.uid()) and public.has_permission('stories.create'))
  )
  with check (
    public.has_permission('stories.manage_highlights')
    or (author_id = (select auth.uid()) and public.has_permission('stories.create') and not is_highlight)
  );

drop policy if exists stories_delete on public.stories;
create policy stories_delete on public.stories for delete to authenticated
  using (
    public.has_permission('stories.delete_any')
    or (author_id = (select auth.uid()) and public.has_permission('stories.delete_own'))
  );

-- ---------------------------------------------------------------------
-- story_views: inserção SOMENTE pela função register_story_view (0008).
-- Leitura: o próprio (para saber o que já viu) ou quem tem estatísticas.
-- ---------------------------------------------------------------------
drop policy if exists story_views_select on public.story_views;
create policy story_views_select on public.story_views for select to authenticated
  using (viewer_id = (select auth.uid()) or public.has_permission('stories.view_stats'));

-- ---------------------------------------------------------------------
-- story_likes / story_reactions
-- ---------------------------------------------------------------------
drop policy if exists story_likes_select on public.story_likes;
create policy story_likes_select on public.story_likes for select to authenticated
  using (user_id = (select auth.uid()) or public.has_any_permission(array['stories.view_stats', 'users.view_history']));

drop policy if exists story_likes_insert on public.story_likes;
create policy story_likes_insert on public.story_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user() and public.is_story_active(story_id));

drop policy if exists story_likes_delete on public.story_likes;
create policy story_likes_delete on public.story_likes for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user());

drop policy if exists story_reactions_select on public.story_reactions;
create policy story_reactions_select on public.story_reactions for select to authenticated
  using (user_id = (select auth.uid()) or public.has_any_permission(array['stories.view_stats', 'users.view_history']));

drop policy if exists story_reactions_insert on public.story_reactions;
create policy story_reactions_insert on public.story_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user() and public.is_story_active(story_id));

drop policy if exists story_reactions_delete on public.story_reactions;
create policy story_reactions_delete on public.story_reactions for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user());

-- ---------------------------------------------------------------------
-- story_comments
-- ---------------------------------------------------------------------
drop policy if exists story_comments_select on public.story_comments;
create policy story_comments_select on public.story_comments for select to anon, authenticated
  using (
    public.is_story_active(story_id)
    or public.can_manage_stories()
    or public.has_any_permission(array['comments.delete_any', 'users.view_history'])
  );

drop policy if exists story_comments_insert on public.story_comments;
create policy story_comments_insert on public.story_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user() and public.is_story_active(story_id));

drop policy if exists story_comments_delete on public.story_comments;
create policy story_comments_delete on public.story_comments for delete to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('comments.delete_any'));

-- ---------------------------------------------------------------------
-- notifications: cada um vê/marca/apaga só as suas. Criadas por triggers.
-- Somente a coluna read_at pode ser alterada pelo usuário.
-- ---------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- audit_logs: só leitura com audit.view (escrita apenas por triggers)
-- ---------------------------------------------------------------------
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.has_permission('audit.view'));

-- ---------------------------------------------------------------------
-- push_subscriptions (Fase 5): cada um gerencia as suas
-- ---------------------------------------------------------------------
drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user());

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
