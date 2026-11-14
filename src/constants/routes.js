// Caminhos das rotas em um só lugar
export const ROUTES = {
  HOME: '/',
  POST: (slug = ':slug') => `/post/${slug}`,
  STORIES: '/stories',
  NOTIFICATIONS: '/notificacoes',
  PROFILE: '/perfil',
  LOGIN: '/login',
  REGISTER: '/cadastro',
  FORGOT_PASSWORD: '/recuperar-senha',
  RESET_PASSWORD: '/redefinir-senha',
  COMPLETE_PROFILE: '/completar-cadastro',
  TERMS: '/termos',
  PRIVACY: '/privacidade',

  ADMIN: '/admin',
  ADMIN_POSTS: '/admin/posts',
  ADMIN_POST_NEW: '/admin/posts/novo',
  ADMIN_POST_EDIT: (id = ':id') => `/admin/posts/${id}`,
  ADMIN_CATEGORIES: '/admin/categorias',
  ADMIN_STORIES: '/admin/stories',
  ADMIN_HIGHLIGHTS: '/admin/destaques',
  ADMIN_USERS: '/admin/clientes',
  ADMIN_USER: (id = ':id') => `/admin/clientes/${id}`,
  ADMIN_STAFF: '/admin/equipe',
  ADMIN_ROLES: '/admin/perfis',
  ADMIN_ROLE: (id = ':id') => `/admin/perfis/${id}`,
  ADMIN_COMMENTS: '/admin/comentarios',
  ADMIN_AUDIT: '/admin/auditoria',
  ADMIN_BRAND: '/admin/identidade',
}

// Rotas que um usuário com cadastro incompleto ainda pode acessar
export const INCOMPLETE_PROFILE_ALLOWED = [
  ROUTES.COMPLETE_PROFILE,
  ROUTES.TERMS,
  ROUTES.PRIVACY,
  ROUTES.RESET_PASSWORD,
]
