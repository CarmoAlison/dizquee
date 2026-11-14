// Itens do menu do admin. Cada um aparece só para quem tem acesso ao módulo.
// Novos módulos (loja, agenda...) entram aqui + ADMIN_MODULE_ACCESS + rotas.
import { ROUTES } from '../../../constants/routes'

export const ADMIN_NAV = [
  { module: null, label: 'Início', icon: 'dashboard', to: ROUTES.ADMIN, end: true, primary: true },
  { module: 'posts', label: 'Posts', icon: 'posts', to: ROUTES.ADMIN_POSTS, primary: true },
  { module: 'categories', label: 'Categorias', icon: 'tag', to: ROUTES.ADMIN_CATEGORIES },
  { module: 'stories', label: 'Stories', icon: 'stories', to: ROUTES.ADMIN_STORIES, primary: true },
  { module: 'highlights', label: 'Destaques', icon: 'star', to: ROUTES.ADMIN_HIGHLIGHTS },
  { module: 'users', label: 'Clientes', icon: 'users', to: ROUTES.ADMIN_USERS },
  { module: 'comments', label: 'Comentários', icon: 'comment', to: ROUTES.ADMIN_COMMENTS },
  { module: 'staff', label: 'Equipe', icon: 'shield', to: ROUTES.ADMIN_STAFF },
  { module: 'roles', label: 'Perfis de acesso', icon: 'key', to: ROUTES.ADMIN_ROLES },
  { module: 'audit', label: 'Auditoria', icon: 'list', to: ROUTES.ADMIN_AUDIT },
  { module: 'settings', label: 'Identidade visual', icon: 'palette', to: ROUTES.ADMIN_BRAND },
]
