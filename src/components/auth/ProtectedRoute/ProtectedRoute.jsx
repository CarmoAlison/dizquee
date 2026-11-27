// Rotas que exigem login (e, no admin, acesso ao painel)
import { Navigate, Outlet, useLocation } from 'react-router'
import { INCOMPLETE_PROFILE_ALLOWED, ROUTES } from '../../../constants/routes'
import { useAuth } from '../../../hooks/useAuth'
import { usePermission } from '../../../hooks/usePermission'
import { Loader } from '../../common/Loader/Loader'
import { AccessDenied } from '../AccessDenied/AccessDenied'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loader fullPage />
  if (!isAuthenticated) {
    return <Navigate to={`${ROUTES.LOGIN}?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }
  return children || <Outlet />
}

export function AdminRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const { canAccessAdmin } = usePermission()
  const location = useLocation()
  if (loading) return <Loader fullPage />
  if (!isAuthenticated) {
    return <Navigate to={`${ROUTES.LOGIN}?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }
  if (!canAccessAdmin) return <AccessDenied />
  return children || <Outlet />
}

// Só para visitantes (login/cadastro): quem já entrou volta para o início
export function GuestRoute({ children }) {
  const { isAuthenticated, loading, isRecovery } = useAuth()
  const params = new URLSearchParams(useLocation().search)
  if (loading) return <Loader fullPage />
  if (isAuthenticated && !isRecovery) {
    const redirect = params.get('redirect')
    return <Navigate to={redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : ROUTES.HOME} replace />
  }
  return children || <Outlet />
}

// Leva quem tem cadastro incompleto (Google/telefone/termos novos) para completar
export function ProfileCompletionGuard({ children }) {
  const { needsProfileCompletion, loading } = useAuth()
  const location = useLocation()
  if (!loading && needsProfileCompletion && !INCOMPLETE_PROFILE_ALLOWED.includes(location.pathname)) {
    return (
      <Navigate to={`${ROUTES.COMPLETE_PROFILE}?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
    )
  }
  return children
}
