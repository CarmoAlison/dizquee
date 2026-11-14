// Rotas do painel (/admin). Cada módulo exige pelo menos uma permissão do
// módulo (UX); a proteção real dos dados é a RLS no banco.
import { lazy } from 'react'
import { Route } from 'react-router'
import { AccessDenied } from '../components/auth/AccessDenied/AccessDenied'
import { AdminRoute } from '../components/auth/ProtectedRoute/ProtectedRoute'
import { PermissionGate } from '../components/auth/PermissionGate/PermissionGate'
import { AdminLayout } from '../components/layout/AdminLayout/AdminLayout'
import { ADMIN_MODULE_ACCESS, PERMISSIONS } from '../constants/permissions'

const Dashboard = lazy(() => import('../pages/admin/Dashboard/Dashboard'))
const Posts = lazy(() => import('../pages/admin/Posts/Posts'))
const PostEditor = lazy(() => import('../pages/admin/PostEditor/PostEditor'))
const Categories = lazy(() => import('../pages/admin/Categories/Categories'))
const Stories = lazy(() => import('../pages/admin/Stories/Stories'))
const Highlights = lazy(() => import('../pages/admin/Highlights/Highlights'))
const Users = lazy(() => import('../pages/admin/Users/Users'))
const UserDetails = lazy(() => import('../pages/admin/UserDetails/UserDetails'))
const Staff = lazy(() => import('../pages/admin/Staff/Staff'))
const Roles = lazy(() => import('../pages/admin/Roles/Roles'))
const RoleEditor = lazy(() => import('../pages/admin/RoleEditor/RoleEditor'))
const Comments = lazy(() => import('../pages/admin/Comments/Comments'))
const AuditLogs = lazy(() => import('../pages/admin/AuditLogs/AuditLogs'))
const BrandSettings = lazy(() => import('../pages/admin/BrandSettings/BrandSettings'))

const P = PERMISSIONS

function Guard({ permission, children }) {
  return (
    <PermissionGate permission={permission} fallback={<AccessDenied />}>
      {children}
    </PermissionGate>
  )
}

export function AdminRoutes() {
  return (
    <Route
      path="admin"
      element={
        <AdminRoute>
          <AdminLayout />
        </AdminRoute>
      }
    >
      <Route index element={<Dashboard />} />
      <Route path="posts" element={<Guard permission={ADMIN_MODULE_ACCESS.posts}><Posts /></Guard>} />
      <Route path="posts/novo" element={<Guard permission={P.POSTS_CREATE}><PostEditor /></Guard>} />
      <Route
        path="posts/:id"
        element={<Guard permission={[P.POSTS_EDIT_OWN, P.POSTS_EDIT_ANY, P.POSTS_CREATE]}><PostEditor /></Guard>}
      />
      <Route path="categorias" element={<Guard permission={ADMIN_MODULE_ACCESS.categories}><Categories /></Guard>} />
      <Route path="stories" element={<Guard permission={ADMIN_MODULE_ACCESS.stories}><Stories /></Guard>} />
      <Route path="destaques" element={<Guard permission={ADMIN_MODULE_ACCESS.highlights}><Highlights /></Guard>} />
      <Route path="clientes" element={<Guard permission={ADMIN_MODULE_ACCESS.users}><Users /></Guard>} />
      <Route path="clientes/:id" element={<Guard permission={ADMIN_MODULE_ACCESS.users}><UserDetails /></Guard>} />
      <Route path="equipe" element={<Guard permission={ADMIN_MODULE_ACCESS.staff}><Staff /></Guard>} />
      <Route path="perfis" element={<Guard permission={ADMIN_MODULE_ACCESS.roles}><Roles /></Guard>} />
      <Route path="perfis/:id" element={<Guard permission={ADMIN_MODULE_ACCESS.roles}><RoleEditor /></Guard>} />
      <Route path="comentarios" element={<Guard permission={ADMIN_MODULE_ACCESS.comments}><Comments /></Guard>} />
      <Route path="auditoria" element={<Guard permission={ADMIN_MODULE_ACCESS.audit}><AuditLogs /></Guard>} />
      <Route path="identidade" element={<Guard permission={ADMIN_MODULE_ACCESS.settings}><BrandSettings /></Guard>} />
      <Route path="*" element={<AccessDenied />} />
    </Route>
  )
}
