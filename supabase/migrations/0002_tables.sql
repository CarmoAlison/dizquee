-- =====================================================================
-- 0002 - Tabelas de TODAS as fases (perfis, permissões, posts, stories,
-- notificações, auditoria e push), com validações (CHECK/UNIQUE/NOT NULL)
-- e índices. Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfis de acesso (roles) e permissões
-- ---------------------------------------------------------------------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(trim(name)) between 2 and 60),
  description text check (char_length(description) <= 300),
  -- Perfil de sistema (Super Admin): protegido contra edição/exclusão
  -- e com TODAS as permissões automaticamente.
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z_]+\.[a-z_]+$'),
  module      text not null check (char_length(module) between 2 and 40),
  description text check (char_length(description) <= 200)
);

create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);
create index if not exists role_permissions_permission_idx on public.role_permissions (permission_id);

-- ---------------------------------------------------------------------
-- Perfis de usuário (1:1 com auth.users)
-- Dados sensíveis (e-mail, telefone) NÃO são públicos: a leitura pública
-- acontece pela view public_profiles (somente nome, usuário e foto).
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text check (char_length(full_name) <= 80),
  username          text unique check (username ~ '^[a-z0-9_.]{3,30}$'),
  email             text check (char_length(email) <= 255),
  phone             text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_url        text check (char_length(avatar_url) <= 500),
  role_id           uuid references public.roles(id) on delete set null,
  is_staff          boolean not null default false,
  is_active         boolean not null default true,   -- staff ativo/desativado
  is_banned         boolean not null default false,
  banned_at         timestamptz,
  banned_reason     text check (char_length(banned_reason) <= 500),
  banned_by         uuid references auth.users(id) on delete set null,
  terms_accepted_at timestamptz,
  terms_version     text check (char_length(terms_version) <= 20),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists profiles_role_idx       on public.profiles (role_id);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_is_staff_idx   on public.profiles (is_staff) where is_staff;
create index if not exists profiles_is_banned_idx  on public.profiles (is_banned) where is_banned;

-- ---------------------------------------------------------------------
-- Categorias e posts
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 40),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  description text check (char_length(description) <= 300),
  color       text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists categories_position_idx on public.categories (position);

create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(trim(title)) between 3 and 150),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 180),
  content       text not null default '' check (char_length(content) <= 10000),
  author_id     uuid references public.profiles(id) on delete set null,
  status        public.post_status not null default 'draft',
  published_at  timestamptz,
  like_count    integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists posts_author_idx    on public.posts (author_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
-- Índice do feed (paginação por cursor: published_at + id)
create index if not exists posts_feed_idx on public.posts (published_at desc, id desc) where status = 'published';

create table if not exists public.post_categories (
  post_id     uuid not null references public.posts(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (post_id, category_id)
);
create index if not exists post_categories_category_idx on public.post_categories (category_id);

create table if not exists public.post_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  type         public.media_type not null,
  storage_path text not null check (char_length(storage_path) <= 300),
  position     integer not null default 0,
  width        integer check (width > 0),
  height       integer check (height > 0),
  duration     numeric(7,2) check (duration >= 0),
  created_at   timestamptz not null default now()
);
create index if not exists post_media_post_idx on public.post_media (post_id, position);

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id, created_at desc);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  parent_id  uuid references public.comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx    on public.comments (post_id, created_at);
create index if not exists comments_parent_idx  on public.comments (parent_id);
create index if not exists comments_user_idx    on public.comments (user_id, created_at desc);
create index if not exists comments_created_idx on public.comments (created_at desc);

-- ---------------------------------------------------------------------
-- Destaques e stories
-- ---------------------------------------------------------------------
create table if not exists public.highlights (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(trim(title)) between 1 and 40),
  cover_path text check (char_length(cover_path) <= 300),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists highlights_position_idx on public.highlights (position);

create table if not exists public.stories (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references public.profiles(id) on delete set null,
  media_type    public.media_type not null,
  storage_path  text not null check (char_length(storage_path) <= 300),
  caption       text check (char_length(caption) <= 300),
  expires_at    timestamptz,
  is_highlight  boolean not null default false,
  highlight_id  uuid references public.highlights(id) on delete set null,
  width         integer check (width > 0),
  height        integer check (height > 0),
  duration      numeric(6,2) check (duration >= 0),
  view_count    integer not null default 0 check (view_count >= 0),
  like_count    integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at    timestamptz not null default now(),
  -- Ou é destaque (com coleção), ou expira.
  constraint stories_validity_chk check (
    (is_highlight and highlight_id is not null) or (not is_highlight and expires_at is not null)
  )
);
create index if not exists stories_expires_idx   on public.stories (expires_at);
create index if not exists stories_highlight_idx on public.stories (highlight_id, created_at);
create index if not exists stories_author_idx    on public.stories (author_id);
create index if not exists stories_created_idx   on public.stories (created_at desc);

create table if not exists public.story_views (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories(id) on delete cascade,
  viewer_id  uuid references public.profiles(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 64),
  viewed_at  timestamptz not null default now()
);
-- Sem duplicar: 1 view por usuário logado, ou 1 por sessão anônima
create unique index if not exists story_views_user_uniq on public.story_views (story_id, viewer_id) where viewer_id is not null;
create unique index if not exists story_views_session_uniq on public.story_views (story_id, session_id) where viewer_id is null;
create index if not exists story_views_viewer_idx on public.story_views (viewer_id);

create table if not exists public.story_likes (
  story_id   uuid not null references public.stories(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
create index if not exists story_likes_user_idx on public.story_likes (user_id);

create table if not exists public.story_reactions (
  story_id   uuid not null references public.stories(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('🔥','❤️','👏','😍','😂','😮','🎉','💜')),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id, emoji)
);
create index if not exists story_reactions_user_idx on public.story_reactions (user_id);

create table if not exists public.story_comments (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories(id) on delete cascade,
  parent_id  uuid references public.story_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists story_comments_story_idx   on public.story_comments (story_id, created_at);
create index if not exists story_comments_parent_idx  on public.story_comments (parent_id);
create index if not exists story_comments_user_idx    on public.story_comments (user_id, created_at desc);
create index if not exists story_comments_created_idx on public.story_comments (created_at desc);

-- ---------------------------------------------------------------------
-- Notificações, auditoria e push
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,  -- destinatário
  type             public.notification_type not null,
  actor_id         uuid references public.profiles(id) on delete cascade,
  post_id          uuid references public.posts(id) on delete cascade,
  story_id         uuid references public.stories(id) on delete cascade,
  comment_id       uuid references public.comments(id) on delete cascade,
  story_comment_id uuid references public.story_comments(id) on delete cascade,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index if not exists notifications_actor_idx on public.notifications (actor_id);
create index if not exists notifications_post_idx on public.notifications (post_id);
create index if not exists notifications_story_idx on public.notifications (story_id);

create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (char_length(action) <= 60),
  entity     text not null check (char_length(entity) <= 60),
  entity_id  text check (char_length(entity_id) <= 100),
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx   on public.audit_logs (actor_id);
create index if not exists audit_logs_entity_idx  on public.audit_logs (entity, action);

-- Fase 5 (push no celular): tabela já criada, ainda sem uso no front.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) <= 1000),
  keys       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
