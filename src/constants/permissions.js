// Chaves de permissão (iguais às da tabela public.permissions).
// Novos módulos (ex.: loja, agenda) entram aqui com o mesmo padrão "modulo.acao".
export const PERMISSIONS = {
  POSTS_VIEW_ADMIN: 'posts.view_admin',
  POSTS_CREATE: 'posts.create',
  POSTS_EDIT_OWN: 'posts.edit_own',
  POSTS_EDIT_ANY: 'posts.edit_any',
  POSTS_DELETE_OWN: 'posts.delete_own',
  POSTS_DELETE_ANY: 'posts.delete_any',
  POSTS_PUBLISH: 'posts.publish',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_EDIT: 'categories.edit',
  CATEGORIES_DELETE: 'categories.delete',
  STORIES_CREATE: 'stories.create',
  STORIES_DELETE_OWN: 'stories.delete_own',
  STORIES_DELETE_ANY: 'stories.delete_any',
  STORIES_MANAGE_HIGHLIGHTS: 'stories.manage_highlights',
  STORIES_VIEW_STATS: 'stories.view_stats',
  COMMENTS_DELETE_ANY: 'comments.delete_any',
  USERS_VIEW: 'users.view',
  USERS_VIEW_HISTORY: 'users.view_history',
  USERS_BAN: 'users.ban',
  USERS_UNBAN: 'users.unban',
  STAFF_CREATE: 'staff.create',
  STAFF_EDIT: 'staff.edit',
  STAFF_DELETE: 'staff.delete',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  METRICS_VIEW: 'metrics.view',
  AUDIT_VIEW: 'audit.view',
  SETTINGS_MANAGE: 'settings.manage',
}

const P = PERMISSIONS

// Nome amigável de cada módulo (matriz de permissões no admin)
export const MODULE_LABELS = {
  posts: 'Posts',
  categories: 'Categorias',
  stories: 'Stories e destaques',
  comments: 'Comentários',
  users: 'Clientes',
  staff: 'Equipe interna',
  roles: 'Perfis de acesso',
  metrics: 'Métricas',
  audit: 'Auditoria',
  settings: 'Configurações',
}

// Permissões que dão acesso a cada módulo do painel (qualquer uma delas)
export const ADMIN_MODULE_ACCESS = {
  dashboard: [P.METRICS_VIEW],
  posts: [P.POSTS_VIEW_ADMIN, P.POSTS_CREATE, P.POSTS_EDIT_OWN, P.POSTS_EDIT_ANY, P.POSTS_DELETE_OWN, P.POSTS_DELETE_ANY, P.POSTS_PUBLISH],
  categories: [P.CATEGORIES_CREATE, P.CATEGORIES_EDIT, P.CATEGORIES_DELETE],
  stories: [P.STORIES_CREATE, P.STORIES_DELETE_OWN, P.STORIES_DELETE_ANY, P.STORIES_VIEW_STATS],
  highlights: [P.STORIES_MANAGE_HIGHLIGHTS],
  users: [P.USERS_VIEW],
  staff: [P.STAFF_CREATE, P.STAFF_EDIT, P.STAFF_DELETE],
  roles: [P.ROLES_VIEW, P.ROLES_MANAGE],
  comments: [P.COMMENTS_DELETE_ANY],
  audit: [P.AUDIT_VIEW],
  settings: [P.SETTINGS_MANAGE],
}
