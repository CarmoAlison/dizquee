import { Link, useNavigate, useSearchParams } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { safeRedirect } from '../../../utils/redirect'
import { LoginForm } from '../../../components/auth/LoginForm/LoginForm'
import { AuthLayout } from '../../../components/layout/AuthLayout/AuthLayout'
import styles from '../authPages.module.css'

export default function Login() {
  useDocumentTitle('Entrar', { noindex: true })
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const redirect = safeRedirect(params.get('redirect'))
  const confirmed = params.get('confirmado') === '1'

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Curta, comente e acompanhe tudo do bloco."
      footer={
        <>
          Ainda não tem conta? <Link to={`${ROUTES.REGISTER}?redirect=${encodeURIComponent(redirect)}`}>Cadastre-se</Link>
        </>
      }
    >
      {confirmed && (
        <p className={styles.success} role="status">
          E-mail confirmado! Agora é só entrar.
        </p>
      )}
      <LoginForm redirectPath={redirect} onSuccess={() => navigate(redirect, { replace: true })} />
    </AuthLayout>
  )
}
