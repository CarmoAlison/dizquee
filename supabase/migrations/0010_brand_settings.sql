-- =====================================================================
-- 0010 - Identidade visual configurável pelo painel
-- Uma única linha (id = 1) com nome, slogan, logo e as 4 cores da marca.
-- Leitura pública (o site precisa para se desenhar); alteração só com
-- settings.manage. O logo fica no bucket "brand" (policies da 0005).
-- Idempotente.
-- =====================================================================

create table if not exists public.app_settings (
  id              smallint primary key default 1 check (id = 1),
  brand_name      text not null default 'Bloco Diz Que É' check (char_length(trim(brand_name)) between 2 and 60),
  short_name      text not null default 'Diz Que É' check (char_length(trim(short_name)) between 2 and 24),
  tagline         text not null default 'Novidades, fotos, vídeos e stories do bloco.' check (char_length(tagline) <= 140),
  logo_path       text check (char_length(logo_path) <= 300),
  color_primary_1 text not null default '#660385' check (color_primary_1 ~ '^#[0-9A-Fa-f]{6}$'),
  color_primary_2 text not null default '#AB00B3' check (color_primary_2 ~ '^#[0-9A-Fa-f]{6}$'),
  color_accent_1  text not null default '#FF0096' check (color_accent_1 ~ '^#[0-9A-Fa-f]{6}$'),
  color_accent_2  text not null default '#FDCB26' check (color_accent_2 ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- updated_at / updated_by sempre do servidor
create or replace function public.app_settings_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.id := 1;
  new.updated_at := now();
  new.updated_by := case when exists (select 1 from public.profiles where id = auth.uid()) then auth.uid() end;
  return new;
end;
$$;

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch
  before update on public.app_settings
  for each row execute function public.app_settings_touch();

-- Auditoria (reaproveita a função genérica da 0009)
drop trigger if exists audit_app_settings on public.app_settings;
create trigger audit_app_settings after update on public.app_settings
  for each row execute function public.audit_generic('settings', 'brand_name');

revoke execute on function public.app_settings_touch() from public, anon, authenticated;

-- RLS
alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to anon, authenticated
  using (true);

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- Leitura pública do bucket brand (logo) pela URL pública já existe
-- (bucket público). Upload/remoção: policies brand_* da 0005.
