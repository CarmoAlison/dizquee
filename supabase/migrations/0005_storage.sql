-- =====================================================================
-- 0005 - Storage: buckets e policies
-- Buckets públicos para LEITURA (as URLs públicas não dependem de policy).
-- Upload/alteração/exclusão só por usuários autenticados com permissão,
-- ou, em avatars, apenas dentro da própria pasta ({user_id}/...).
--
-- Limites por arquivo (o plano gratuito do Supabase aceita até 50 MB por
-- arquivo; o limite global do projeto fica em Storage > Settings):
--   avatars ........... 2 MB  (imagens; o front já envia ~512 px WebP)
--   post-media ........ 50 MB (imagens comprimidas + vídeos até 3 min)
--   story-media ....... 30 MB (imagens + vídeos até 30 s)
--   highlight-covers .. 2 MB
--   brand ............. 5 MB
-- Caminhos:
--   avatars/{user_id}/{uuid}.webp
--   post-media/posts/{post_id}/{uuid}.jpg|mp4
--   story-media/stories/{uuid}.webp|mp4
--   highlight-covers/highlights/{uuid}.webp
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152,
    array['image/webp', 'image/jpeg', 'image/png']),
  ('post-media', 'post-media', true, 52428800,
    array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('story-media', 'story-media', true, 31457280,
    array['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('highlight-covers', 'highlight-covers', true, 2097152,
    array['image/webp', 'image/jpeg', 'image/png']),
  ('brand', 'brand', true, 5242880,
    array['image/webp', 'image/jpeg', 'image/png', 'image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- avatars: cada usuário só mexe na própria pasta
-- ---------------------------------------------------------------------
drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_user()
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- post-media: quem cria/edita posts
-- ---------------------------------------------------------------------
drop policy if exists "post_media_select_staff" on storage.objects;
create policy "post_media_select_staff" on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and public.has_any_permission(array['posts.create', 'posts.edit_own', 'posts.edit_any', 'posts.delete_own', 'posts.delete_any']));

drop policy if exists "post_media_insert_staff" on storage.objects;
create policy "post_media_insert_staff" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = 'posts'
    and public.has_any_permission(array['posts.create', 'posts.edit_own', 'posts.edit_any'])
  );

drop policy if exists "post_media_delete_staff" on storage.objects;
create policy "post_media_delete_staff" on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-media'
    and public.has_any_permission(array['posts.edit_own', 'posts.edit_any', 'posts.create', 'posts.delete_own', 'posts.delete_any'])
  );

-- ---------------------------------------------------------------------
-- story-media: quem cria/exclui stories
-- ---------------------------------------------------------------------
drop policy if exists "story_media_select_staff" on storage.objects;
create policy "story_media_select_staff" on storage.objects for select to authenticated
  using (bucket_id = 'story-media' and public.can_manage_stories());

drop policy if exists "story_media_insert_staff" on storage.objects;
create policy "story_media_insert_staff" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'story-media'
    and (storage.foldername(name))[1] = 'stories'
    and public.has_permission('stories.create')
  );

drop policy if exists "story_media_delete_staff" on storage.objects;
create policy "story_media_delete_staff" on storage.objects for delete to authenticated
  using (
    bucket_id = 'story-media'
    and public.has_any_permission(array['stories.create', 'stories.delete_own', 'stories.delete_any'])
  );

-- ---------------------------------------------------------------------
-- highlight-covers: quem gerencia destaques
-- ---------------------------------------------------------------------
drop policy if exists "highlight_covers_select_staff" on storage.objects;
create policy "highlight_covers_select_staff" on storage.objects for select to authenticated
  using (bucket_id = 'highlight-covers' and public.has_permission('stories.manage_highlights'));

drop policy if exists "highlight_covers_insert_staff" on storage.objects;
create policy "highlight_covers_insert_staff" on storage.objects for insert to authenticated
  with check (bucket_id = 'highlight-covers' and public.has_permission('stories.manage_highlights'));

drop policy if exists "highlight_covers_update_staff" on storage.objects;
create policy "highlight_covers_update_staff" on storage.objects for update to authenticated
  using (bucket_id = 'highlight-covers' and public.has_permission('stories.manage_highlights'))
  with check (bucket_id = 'highlight-covers' and public.has_permission('stories.manage_highlights'));

drop policy if exists "highlight_covers_delete_staff" on storage.objects;
create policy "highlight_covers_delete_staff" on storage.objects for delete to authenticated
  using (bucket_id = 'highlight-covers' and public.has_permission('stories.manage_highlights'));

-- ---------------------------------------------------------------------
-- brand: arquivos da identidade visual (settings.manage)
-- ---------------------------------------------------------------------
drop policy if exists "brand_select_staff" on storage.objects;
create policy "brand_select_staff" on storage.objects for select to authenticated
  using (bucket_id = 'brand' and public.has_permission('settings.manage'));

drop policy if exists "brand_insert_staff" on storage.objects;
create policy "brand_insert_staff" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand' and public.has_permission('settings.manage'));

drop policy if exists "brand_update_staff" on storage.objects;
create policy "brand_update_staff" on storage.objects for update to authenticated
  using (bucket_id = 'brand' and public.has_permission('settings.manage'))
  with check (bucket_id = 'brand' and public.has_permission('settings.manage'));

drop policy if exists "brand_delete_staff" on storage.objects;
create policy "brand_delete_staff" on storage.objects for delete to authenticated
  using (bucket_id = 'brand' and public.has_permission('settings.manage'));
