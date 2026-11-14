// Rotas públicas, de visitante (login/cadastro) e protegidas (logado)
import { lazy } from 'react'
import { Route } from 'react-router'
import { GuestRoute, ProtectedRoute } from '../components/auth/ProtectedRoute/ProtectedRoute'
import { PublicLayout } from '../components/layout/PublicLayout/PublicLayout'

const Home = lazy(() => import('../pages/public/Home/Home'))
const PostDetails = lazy(() => import('../pages/public/PostDetails/PostDetails'))
const Stories = lazy(() => import('../pages/public/Stories/Stories'))
const Login = lazy(() => import('../pages/public/Login/Login'))
const Register = lazy(() => import('../pages/public/Register/Register'))
const ForgotPassword = lazy(() => import('../pages/public/ForgotPassword/ForgotPassword'))
const ResetPassword = lazy(() => import('../pages/public/ResetPassword/ResetPassword'))
const CompleteProfile = lazy(() => import('../pages/public/CompleteProfile/CompleteProfile'))
const Profile = lazy(() => import('../pages/public/Profile/Profile'))
const Notifications = lazy(() => import('../pages/public/Notifications/Notifications'))
const Terms = lazy(() => import('../pages/public/Terms/Terms'))
const Privacy = lazy(() => import('../pages/public/Privacy/Privacy'))
const NotFound = lazy(() => import('../pages/public/NotFound/NotFound'))

// Chamada como função dentro de <Routes> (não como componente)
export function PublicRoutes() {
  return (
    <Route element={<PublicLayout />}>
      <Route index element={<Home />} />
      <Route path="post/:slug" element={<PostDetails />} />
      <Route path="stories" element={<Stories />} />
      <Route path="termos" element={<Terms />} />
      <Route path="privacidade" element={<Privacy />} />
      <Route path="redefinir-senha" element={<ResetPassword />} />

      <Route element={<GuestRoute />}>
        <Route path="login" element={<Login />} />
        <Route path="cadastro" element={<Register />} />
        <Route path="recuperar-senha" element={<ForgotPassword />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="perfil" element={<Profile />} />
        <Route path="notificacoes" element={<Notifications />} />
        <Route path="completar-cadastro" element={<CompleteProfile />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Route>
  )
}
