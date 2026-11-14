-- =====================================================================
-- 0001 - Extensões e tipos enumerados
-- Cole no SQL Editor do Supabase (ou rode com a Supabase CLI).
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

-- gen_random_uuid() e funções criptográficas
create extension if not exists pgcrypto with schema extensions;
-- Busca sem acento (usada na busca de clientes/comentários no admin)
create extension if not exists unaccent with schema extensions;

-- Status de publicação dos posts
do $$ begin
  create type public.post_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

-- Tipo de mídia (posts e stories)
do $$ begin
  create type public.media_type as enum ('image', 'video');
exception when duplicate_object then null; end $$;

-- Tipos de notificação dentro do site
do $$ begin
  create type public.notification_type as enum (
    'post_like',        -- alguém curtiu um post seu
    'post_comment',     -- alguém comentou em um post seu
    'comment_reply',    -- alguém respondeu seu comentário em um post
    'story_like',       -- alguém curtiu um story seu
    'story_comment',    -- alguém comentou em um story seu
    'story_reply',      -- alguém respondeu seu comentário em um story
    'story_reaction'    -- alguém reagiu a um story seu
  );
exception when duplicate_object then null; end $$;
