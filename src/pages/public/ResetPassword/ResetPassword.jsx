// Nova senha: usada pelo link de recuperação e pelo convite da equipe
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAuth } from '../../../hooks/useAuth'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useToast } from '../../../hooks/useToast'
import { updatePassword } from '../../../services/authService'
import { getErrorMessage } from '../../../utils/errors'
import { validatePassword } from '../../../utils/validators'
import { Button } from '../../../components/common/Button/Button'
import { Loader } from '../../../components/common/Loader/Loader'
import { PasswordInput } from '../../../components/auth/PasswordInput/PasswordInput'
import { AuthLayout } from '../../../components/layout/AuthLayout/AuthLayout'
import styles from '../authPages.module.css'

export default function ResetPassword() {
  useDocumentTitle('Nova senha', { noindex: true })
  const { isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  if (authLoading) return <Loader fullPage />

  if (!isAuthenticated) {
    return (
      <AuthLayout title="Link inválido ou expirado">
        <p className={styles.info}>Peça um novo link de recuperação de senha.</p>
        <Button to={ROUTES.FORGOT_PASSWORD} fullWidth>
          Pedir novo link
        </Button>
      </AuthLayout>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    const next = {
      password: validatePassword(password),
      confirm: password !== confirm ? 'As senhas não conferem.' : '',
    }
    setErrors(next)
    if (next.password || next.confirm) return
    setLoading(true)
    try {
      await updatePassword(password)
      toast.success('Senha atualizada!')
      navigate(ROUTES.HOME, { replace: true })
    } catch (err) {
      setErrors({ password: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Criar nova senha" subtitle="Escolha uma senha forte, com letras e números.">
      <form className={styles.form} onSubmit={submit} noValidate>
        <PasswordInput
          label="Nova senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          error={errors.password}
          required
        />
        <PasswordInput
          label="Confirme a nova senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={errors.confirm}
          required
        />
        <Button type="submit" fullWidth size="lg" loading={loading}>
          Salvar senha
        </Button>
      </form>
    </AuthLayout>
  )
}
