// Itens do menu do admin, agrupados por seção (o título da seção só aparece
// se a pessoa tiver acesso a pelo menos um item dela). Cada item aparece só
// para quem tem acesso ao módulo.
// Novos módulos (agenda...) entram aqui + ADMIN_MODULE_ACCESS + rotas.
import { ROUTES } from '../../../constants/routes'

export const ADMIN_NAV = [
  { module: null, label: 'Início', icon: 'dashboard', to: ROUTES.ADMIN, end: true, primary: true },

  { group: 'Loja', module: 'orders', label: 'Pedidos', icon: 'bag', to: ROUTES.ADMIN_ORDERS, primary: true },
  { group: 'Loja', module: 'checkin', label: 'Retirada (QR)', icon: 'qr', to: ROUTES.ADMIN_CHECKIN, primary: true },
  { group: 'Loja', module: 'sales', label: 'Venda rápida', icon: 'cart', to: ROUTES.ADMIN_QUICK_SALE, primary: true },
  { group: 'Loja', module: 'products', label: 'Produtos', icon: 'box', to: ROUTES.ADMIN_PRODUCTS },
  { group: 'Loja', module: 'stock', label: 'Estoque', icon: 'layers', to: ROUTES.ADMIN_STOCK },
  { group: 'Loja', module: 'stock', label: 'Compras', icon: 'truck', to: ROUTES.ADMIN_PURCHASES },
  { group: 'Loja', module: 'products', label: 'Config. da loja', icon: 'store', to: ROUTES.ADMIN_SHOP_SETTINGS },

  { group: 'Financeiro', module: 'finance', label: 'Visão geral', icon: 'chart', to: ROUTES.ADMIN_FINANCE, end: true },
  { group: 'Financeiro', module: 'finance', label: 'Lançamentos', icon: 'list', to: ROUTES.ADMIN_FINANCE_ENTRIES },
  { group: 'Financeiro', module: 'financeCategories', label: 'Categorias financeiras', icon: 'tag', to: ROUTES.ADMIN_FINANCE_CATEGORIES },

  { group: 'Conteúdo', module: 'posts', label: 'Posts', icon: 'posts', to: ROUTES.ADMIN_POSTS, primary: true },
  { group: 'Conteúdo', module: 'categories', label: 'Categorias', icon: 'tag', to: ROUTES.ADMIN_CATEGORIES },
  { group: 'Conteúdo', module: 'stories', label: 'Stories', icon: 'stories', to: ROUTES.ADMIN_STORIES, primary: true },
  { group: 'Conteúdo', module: 'highlights', label: 'Destaques', icon: 'star', to: ROUTES.ADMIN_HIGHLIGHTS },
  { group: 'Conteúdo', module: 'comments', label: 'Comentários', icon: 'comment', to: ROUTES.ADMIN_COMMENTS },

  { group: 'Pessoas', module: 'users', label: 'Clientes', icon: 'users', to: ROUTES.ADMIN_USERS },
  { group: 'Pessoas', module: 'staff', label: 'Equipe', icon: 'shield', to: ROUTES.ADMIN_STAFF },
  { group: 'Pessoas', module: 'roles', label: 'Perfis de acesso', icon: 'key', to: ROUTES.ADMIN_ROLES },

  { group: 'Sistema', module: 'audit', label: 'Auditoria', icon: 'list', to: ROUTES.ADMIN_AUDIT },
  { group: 'Sistema', module: 'settings', label: 'Identidade visual', icon: 'palette', to: ROUTES.ADMIN_BRAND },
]

// [{ group, items }] mantendo a ordem acima (itens sem grupo ficam no topo)
export function groupNavItems(items) {
  const groups = []
  for (const item of items) {
    const name = item.group || ''
    let group = groups.find((g) => g.group === name)
    if (!group) {
      group = { group: name, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}
