import { useState } from 'react'
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { sendPasswordReset } from '../../../services/authService'
import { getErrorMessage } from '../../../utils/errors'
import { validateEmail } from '../../../utils/validators'
import { Button } from '../../../components/common/Button/Button'
import { Icon } from '../../../components/common/Icon/Icon'
import { Input } from '../../../components/common/Input/Input'
import { AuthLayout } from '../../../components/layout/AuthLayout/AuthLayout'
import styles from '../authPages.module.css'

export default function ForgotPassword() {
  useDocumentTitle('Recuperar senha', { noindex: true })
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const v = validateEmail(email)
    setError(v)
    if (v) return
    setLoading(true)
    try {
      await sendPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle={sent ? undefined : 'Enviaremos um link para você criar uma nova senha.'}
      footer={<Link to={ROUTES.LOGIN}>Voltar para o login</Link>}
    >
      {sent ? (
        <div className={styles.done} role="status">
          <span className={styles.doneIcon}>
            <Icon name="mail" size={32} />
          </span>
          <p>
            Se existir uma conta com <strong>{email}</strong>, você vai receber um e-mail com o link para redefinir a senha.
          </p>
          <p className={styles.muted}>O link vale por tempo limitado. Confira também o spam.</p>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            error={error}
            required
          />
          <Button type="submit" fullWidth size="lg" loading={loading}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
