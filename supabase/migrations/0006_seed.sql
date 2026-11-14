-- =====================================================================
-- 0006 - Seed: permissões e perfil Super Admin
-- Idempotente. Novas permissões de módulos futuros (loja, agenda...)
-- entram aqui com o mesmo padrão "modulo.acao".
-- =====================================================================

insert into public.permissions (key, module, description) values
  ('posts.view_admin',          'posts',      'Ver posts no painel (incluindo rascunhos)'),
  ('posts.create',              'posts',      'Criar posts'),
  ('posts.edit_own',            'posts',      'Editar os próprios posts'),
  ('posts.edit_any',            'posts',      'Editar qualquer post'),
  ('posts.delete_own',          'posts',      'Excluir os próprios posts'),
  ('posts.delete_any',          'posts',      'Excluir qualquer post'),
  ('posts.publish',             'posts',      'Publicar e despublicar posts'),
  ('categories.create',         'categories', 'Criar categorias'),
  ('categories.edit',           'categories', 'Editar e ordenar categorias'),
  ('categories.delete',         'categories', 'Excluir categorias'),
  ('stories.create',            'stories',    'Criar stories'),
  ('stories.delete_own',        'stories',    'Excluir os próprios stories'),
  ('stories.delete_any',        'stories',    'Excluir qualquer story'),
  ('stories.manage_highlights', 'stories',    'Gerenciar destaques'),
  ('stories.view_stats',        'stories',    'Ver estatísticas e quem viu os stories'),
  ('comments.delete_any',       'comments',   'Excluir qualquer comentário'),
  ('users.view',                'users',      'Ver lista de clientes'),
  ('users.view_history',        'users',      'Ver histórico de curtidas e comentários'),
  ('users.ban',                 'users',      'Banir usuários'),
  ('users.unban',               'users',      'Desbanir usuários'),
  ('staff.create',              'staff',      'Criar usuários da equipe'),
  ('staff.edit',                'staff',      'Editar equipe (ativar, desativar, trocar perfil)'),
  ('staff.delete',              'staff',      'Remover pessoas da equipe'),
  ('roles.view',                'roles',      'Ver perfis de acesso'),
  ('roles.manage',              'roles',      'Criar, editar e excluir perfis de acesso'),
  ('metrics.view',              'metrics',    'Ver o dashboard de métricas'),
  ('audit.view',                'audit',      'Ver o log de auditoria'),
  ('settings.manage',           'settings',   'Gerenciar configurações e identidade visual')
on conflict (key) do update set
  module = excluded.module,
  description = excluded.description;

-- Perfil de sistema: Super Admin (todas as permissões, protegido)
insert into public.roles (name, description, is_system)
values ('Super Admin', 'Acesso total ao sistema. Perfil protegido.', true)
on conflict (name) do update set is_system = true;

-- Vincula todas as permissões ao Super Admin (has_permission já libera
-- tudo para perfis de sistema; isto é para a matriz aparecer completa).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Super Admin'
on conflict do nothing;

-- =====================================================================
-- COMO PROMOVER O PRIMEIRO SUPER ADMIN
-- 1. Cadastre-se normalmente no site (e confirme o e-mail).
-- 2. No SQL Editor do Supabase, rode (trocando o e-mail):
--
--   update public.profiles
--      set is_staff = true,
--          is_active = true,
--          role_id = (select id from public.roles where name = 'Super Admin')
--    where email = 'seu-email@exemplo.com';
--
-- 3. Saia e entre de novo no site: o link "Painel" aparece no menu.
-- (Pelo SQL Editor não há auth.uid(), então o trigger de proteção permite.)
-- =====================================================================
