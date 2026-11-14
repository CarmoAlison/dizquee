import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useToast } from '../../../hooks/useToast'
import { resendConfirmation } from '../../../services/authService'
import { getErrorMessage } from '../../../utils/errors'
import { safeRedirect } from '../../../utils/redirect'
import { Button } from '../../../components/common/Button/Button'
import { Icon } from '../../../components/common/Icon/Icon'
import { RegisterForm } from '../../../components/auth/RegisterForm/RegisterForm'
import { SocialButtons } from '../../../components/auth/SocialButtons/SocialButtons'
import { AuthDivider } from '../../../components/auth/AuthDivider/AuthDivider'
import { AuthLayout } from '../../../components/layout/AuthLayout/AuthLayout'
import styles from '../authPages.module.css'

export default function Register() {
  useDocumentTitle('Criar conta', { noindex: true })
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const redirect = safeRedirect(params.get('redirect'))
  const [pendingEmail, setPendingEmail] = useState('')

  const onDone = ({ needsConfirmation, email }) => {
    if (needsConfirmation) setPendingEmail(email)
    else navigate(redirect, { replace: true })
  }

  const resend = async () => {
    try {
      await resendConfirmation(pendingEmail)
      toast.success('Link reenviado!')
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  if (pendingEmail) {
    return (
      <AuthLayout title="Confirme seu e-mail">
        <div className={styles.done}>
          <span className={styles.doneIcon}>
            <Icon name="mail" size={32} />
          </span>
          <p>
            Enviamos um link de confirmação para <strong>{pendingEmail}</strong>. Abra o e-mail e clique no link para ativar
            sua conta.
          </p>
          <p className={styles.muted}>Não chegou? Veja a caixa de spam ou peça outro link.</p>
          <Button variant="secondary" onClick={resend}>
            Reenviar link
          </Button>
          <Button to={ROUTES.LOGIN} variant="ghost">
            Ir para o login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="É grátis e leva menos de um minuto."
      footer={
        <>
          Já tem conta? <Link to={`${ROUTES.LOGIN}?redirect=${encodeURIComponent(redirect)}`}>Entrar</Link>
        </>
      }
    >
      <SocialButtons redirectPath={redirect} onPhone={() => navigate(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(redirect)}`)} />
      <AuthDivider>ou cadastre-se com e-mail</AuthDivider>
      <RegisterForm onDone={onDone} />
    </AuthLayout>
  )
}
