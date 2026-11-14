// Login por e-mail/senha + Google + telefone (OTP)
import { useState } from 'react'
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useToast } from '../../../hooks/useToast'
import { resendConfirmation, signInWithPassword } from '../../../services/authService'
import { getErrorMessage } from '../../../utils/errors'
import { validateEmail } from '../../../utils/validators'
import { Button } from '../../common/Button/Button'
import { Input } from '../../common/Input/Input'
import { AuthDivider } from '../AuthDivider/AuthDivider'
import { PasswordInput } from '../PasswordInput/PasswordInput'
import { PhoneOtpForm } from '../PhoneOtpForm/PhoneOtpForm'
import { SocialButtons } from '../SocialButtons/SocialButtons'
import styles from './LoginForm.module.css'

export function LoginForm({ onSuccess, redirectPath }) {
  const toast = useToast()
  const [mode, setMode] = useState('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [notConfirmed, setNotConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const next = { email: validateEmail(email), password: password ? '' : 'Informe sua senha.' }
    setErrors(next)
    if (next.email || next.password) return
    setLoading(true)
    setFormError('')
    setNotConfirmed(false)
    try {
      await signInWithPassword(email, password)
      onSuccess?.()
    } catch (err) {
      if (/email not confirmed/i.test(err.message)) setNotConfirmed(true)
      setFormError(getErrorMessage(err, 'Não foi possível entrar.'))
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    try {
      await resendConfirmation(email)
      toast.success('Enviamos um novo link de confirmação para seu e-mail.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (mode === 'phone') {
    return <PhoneOtpForm onSuccess={onSuccess} onBack={() => setMode('email')} />
  }

  return (
    <div className={styles.wrapper}>
      <SocialButtons redirectPath={redirectPath} onPhone={() => setMode('phone')} />
      <AuthDivider>ou entre com e-mail</AuthDivider>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          error={errors.email}
          required
        />
        <PasswordInput
          label="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          error={errors.password}
          required
        />
        <div className={styles.forgot}>
          <Link to={ROUTES.FORGOT_PASSWORD}>Esqueci minha senha</Link>
        </div>
        {formError && (
          <div className={styles.formError} role="alert">
            <p>{formError}</p>
            {notConfirmed && (
              <button type="button" className={styles.textButton} onClick={resend}>
                Reenviar e-mail de confirmação
              </button>
            )}
          </div>
        )}
        <Button type="submit" fullWidth loading={loading} size="lg">
          Entrar
        </Button>
      </form>
    </div>
  )
}
