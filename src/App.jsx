// Ordem dos providers: tema -> toasts -> marca -> sessão -> permissões ->
// notificações -> modal de login (usa toasts e sessão)
import { AuthProvider } from './contexts/AuthContext'
import { BrandProvider } from './contexts/BrandContext'
import { LoginPromptProvider } from './contexts/LoginPromptContext'
import { NotificationsProvider } from './contexts/NotificationsContext'
import { PermissionProvider } from './contexts/PermissionContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { AppRoutes } from './routes/AppRoutes'
import { isSupabaseConfigured } from './services/supabaseClient'
import { SetupNotice } from './components/common/SetupNotice/SetupNotice'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        {!isSupabaseConfigured ? (
          <SetupNotice />
        ) : (
          <BrandProvider>
            <AuthProvider>
              <PermissionProvider>
                <NotificationsProvider>
                  <LoginPromptProvider>
                    <AppRoutes />
                  </LoginPromptProvider>
                </NotificationsProvider>
              </PermissionProvider>
            </AuthProvider>
          </BrandProvider>
        )}
      </ToastProvider>
    </ThemeProvider>
  )
}
