-- =====================================================================
-- 0003 - Funções e triggers centrais (Fase 1)
--   * has_permission / has_any_permission / is_super_admin / is_active_user
--   * my_permissions (lista de permissões para o front-end)
--   * criação automática do profile ao criar usuário em auth.users
--   * proteção de campos sensíveis do profile (role_id, is_banned...)
--   * verificação de nome de usuário disponível
--   * exclusão da própria conta (LGPD)
--   * view pública de perfis (somente dados não sensíveis)
-- Todas as funções SECURITY DEFINER usam search_path vazio e nomes
-- totalmente qualificados para evitar sequestro de search_path.
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at genérico
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------

-- Retorna true se o usuário logado é staff ativo, não banido, e o perfil
-- de acesso dele tem a permissão (perfis de sistema têm todas).
create or replace function public.has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and p.is_staff
      and p.is_active
      and not p.is_banned
      and (
        r.is_system
        or exists (
          select 1
          from public.role_permissions rp
          join public.permissions perm on perm.id = rp.permission_id
          where rp.role_id = r.id
            and perm.key = permission_key
        )
      )
  );
$$;

-- Verdadeiro se tiver QUALQUER uma das permissões da lista.
create or replace function public.has_any_permission(permission_keys text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from unnest(permission_keys) k where public.has_permission(k)
  );
$$;

-- Verdadeiro se o usuário logado tem um perfil de sistema (Super Admin).
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_staff and p.is_active and not p.is_banned and r.is_system
  );
$$;

-- Verdadeiro se o usuário está logado e NÃO está banido.
-- Usada em todas as policies de interação (curtir, comentar, reagir...).
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and not p.is_banned
  );
$$;

-- Lista de chaves de permissão do usuário logado (para o front-end
-- esconder/mostrar botões; a segurança real continua sendo a RLS).
create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(perm.key order by perm.key), '{}')
  from public.permissions perm
  where exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_staff and p.is_active and not p.is_banned
      and (
        r.is_system
        or exists (
          select 1 from public.role_permissions rp
          where rp.role_id = r.id and rp.permission_id = perm.id
        )
      )
  );
$$;

-- ---------------------------------------------------------------------
-- Criação automática do profile
-- O cadastro por e-mail envia em raw_user_meta_data: full_name, username,
-- phone e terms_version. Google envia full_name/name e avatar_url.
-- Telefone (OTP) preenche auth.users.phone.
-- ---------------------------------------------------------------------
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p_phone is null or trim(p_phone) = '' then
    return null;
  end if;
  v := regexp_replace(p_phone, '[^0-9+]', '', 'g');
  if left(v, 1) <> '+' then
    v := '+' || v;
  end if;
  if v !~ '^\+[1-9][0-9]{7,14}$' then
    return null;
  end if;
  return v;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(nullif(trim(meta ->> 'username'), ''));
  v_terms    text := nullif(trim(meta ->> 'terms_version'), '');
begin
  -- Nome de usuário inválido ou já usado: fica nulo e a pessoa completa depois.
  if v_username is not null and (
       v_username !~ '^[a-z0-9_.]{3,30}$'
       or exists (select 1 from public.profiles where username = v_username)
     ) then
    v_username := null;
  end if;

  insert into public.profiles (
    id, full_name, username, email, phone, avatar_url, terms_accepted_at, terms_version
  ) values (
    new.id,
    left(coalesce(nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', '')), 80),
    v_username,
    new.email,
    public.normalize_phone(coalesce(nullif(meta ->> 'phone', ''), new.phone)),
    left(nullif(meta ->> 'avatar_url', ''), 500),
    case when v_terms is not null then now() end,
    left(v_terms, 20)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém o e-mail do profile sincronizado com auth.users.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    perform set_config('app.bypass_profile_guard', 'on', true);
    update public.profiles set email = new.email where id = new.id;
    perform set_config('app.bypass_profile_guard', 'off', true);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------
-- Proteção de campos sensíveis do profile
-- * Ninguém altera o próprio role_id / is_staff / is_active / banimento.
-- * Banir exige users.ban; desbanir exige users.unban.
-- * Alterar equipe exige staff.edit (ou staff.delete para remover da equipe).
-- * Só Super Admin atribui/remove o perfil de sistema.
-- * Staff não altera nome/usuário/telefone/foto de outra pessoa.
-- Execuções sem usuário (SQL Editor, service role) passam livremente.
-- ---------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_old_system boolean;
  v_new_system boolean;
begin
  if coalesce(current_setting('app.bypass_profile_guard', true), '') = 'on' or v_uid is null then
    return new;
  end if;

  new.created_at := old.created_at;

  if new.email is distinct from old.email then
    raise exception 'O e-mail só pode ser alterado pela conta de acesso.' using errcode = '42501';
  end if;

  -- Outra pessoa (staff) não altera dados pessoais
  if new.id <> v_uid and (
       new.full_name is distinct from old.full_name
       or new.username is distinct from old.username
       or new.phone is distinct from old.phone
       or new.avatar_url is distinct from old.avatar_url
       or new.terms_version is distinct from old.terms_version
     ) then
    raise exception 'Você não pode alterar os dados pessoais de outro usuário.' using errcode = '42501';
  end if;

  -- Aceite de termos: data sempre é a do servidor
  if new.terms_version is distinct from old.terms_version then
    new.terms_accepted_at := now();
  else
    new.terms_accepted_at := old.terms_accepted_at;
  end if;

  -- Banimento
  if new.is_banned is distinct from old.is_banned
     or new.banned_reason is distinct from old.banned_reason then
    if new.id = v_uid then
      raise exception 'Você não pode alterar o próprio banimento.' using errcode = '42501';
    end if;
    if new.is_banned and not public.has_permission('users.ban') then
      raise exception 'Sem permissão para banir usuários.' using errcode = '42501';
    end if;
    if not new.is_banned and old.is_banned and not public.has_permission('users.unban') then
      raise exception 'Sem permissão para desbanir usuários.' using errcode = '42501';
    end if;
    if new.is_banned and exists (
         select 1 from public.roles r where r.id = old.role_id and r.is_system
       ) then
      raise exception 'Um Super Admin não pode ser banido.' using errcode = '42501';
    end if;
  end if;
  if new.is_banned then
    if not old.is_banned then
      new.banned_at := now();
      new.banned_by := v_uid;
    else
      new.banned_at := old.banned_at;
      -- (permite que a FK zere banned_by quando o autor do banimento é excluído)
      if new.banned_by is not null then
        new.banned_by := old.banned_by;
      end if;
    end if;
  else
    new.banned_at := null;
    new.banned_by := null;
    new.banned_reason := null;
  end if;

  -- Equipe / perfil de acesso
  if new.role_id is distinct from old.role_id
     or new.is_staff is distinct from old.is_staff
     or new.is_active is distinct from old.is_active then
    if new.id = v_uid then
      raise exception 'Você não pode alterar o próprio perfil de acesso.' using errcode = '42501';
    end if;
    -- Remover da equipe (is_staff = false) aceita staff.delete; o resto exige staff.edit
    if not public.has_permission('staff.edit')
       and not (public.has_permission('staff.delete') and old.is_staff and not new.is_staff) then
      raise exception 'Sem permissão para alterar a equipe.' using errcode = '42501';
    end if;
    select coalesce(bool_or(r.is_system), false) into v_old_system from public.roles r where r.id = old.role_id;
    select coalesce(bool_or(r.is_system), false) into v_new_system from public.roles r where r.id = new.role_id;
    if (v_old_system or v_new_system) and not public.is_super_admin() then
      raise exception 'Somente um Super Admin pode atribuir ou remover o perfil de sistema.' using errcode = '42501';
    end if;
  end if;

  -- Quem sai da equipe perde o perfil de acesso
  if not new.is_staff then
    new.role_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------------
-- Nome de usuário disponível? (validação em tempo real no cadastro)
-- Ignora o próprio usuário logado (edição de perfil).
-- ---------------------------------------------------------------------
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(p_username) ~ '^[a-z0-9_.]{3,30}$'
     and not exists (
       select 1 from public.profiles
       where username = lower(p_username)
         and id is distinct from auth.uid()
     );
$$;

-- ---------------------------------------------------------------------
-- Exclusão da própria conta (direito do titular - LGPD)
-- Remove auth.users; o profile e os dados ligados (curtidas, comentários,
-- reações, notificações) saem em cascata. Os arquivos do avatar são
-- removidos antes pelo front-end (Storage API).
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;

  if public.is_super_admin() and (
    select count(*) from public.profiles p join public.roles r on r.id = p.role_id
    where r.is_system and p.is_staff and p.is_active
  ) <= 1 then
    raise exception 'Você é o único Super Admin. Promova outra pessoa antes de excluir sua conta.' using errcode = '42501';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------
-- View pública de perfis: só dados não sensíveis (sem e-mail/telefone).
-- Usada para mostrar autor de posts e comentários.
-- (security_invoker = false de propósito: ignora a RLS de profiles,
-- mas expõe apenas estas colunas.)
-- ---------------------------------------------------------------------
create or replace view public.public_profiles
with (security_invoker = false) as
  select id, full_name, username, avatar_url, is_staff, created_at
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------
-- Auditoria: função interna usada pelos triggers (Fase 4 usa mais).
-- ---------------------------------------------------------------------
create or replace function public.log_audit(
  p_action text, p_entity text, p_entity_id text, p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    case when exists (select 1 from public.profiles where id = auth.uid()) then auth.uid() end,
    p_action, p_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Privilégios de execução
-- ---------------------------------------------------------------------
revoke execute on function public.log_audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.has_any_permission(text[]) to anon, authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_active_user() to anon, authenticated;
