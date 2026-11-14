import { Suspense, useEffect } from 'react'
import { Routes, useLocation } from 'react-router'
import { ProfileCompletionGuard } from '../components/auth/ProtectedRoute/ProtectedRoute'
import { Loader } from '../components/common/Loader/Loader'
import { AdminRoutes } from './AdminRoutes'
import { PublicRoutes } from './PublicRoutes'

// Volta ao topo ao trocar de página (exceto links com #âncora)
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <ProfileCompletionGuard>
        <Suspense fallback={<Loader fullPage />}>
          <Routes>
            {PublicRoutes()}
            {AdminRoutes()}
          </Routes>
        </Suspense>
      </ProfileCompletionGuard>
    </>
  )
}
