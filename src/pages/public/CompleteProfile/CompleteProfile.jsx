// Etapa obrigatória para quem entrou por Google/telefone (ou foi convidado
// para a equipe) e ainda não tem usuário, telefone ou aceite dos termos atuais.
import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { TERMS_VERSION } from '../../../constants/legal'
import { ROUTES } from '../../../constants/routes'
import { useAuth } from '../../../hooks/useAuth'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useToast } from '../../../hooks/useToast'
import { updateMyProfile } from '../../../services/profileService'
import { getErrorMessage } from '../../../utils/errors'
import { safeRedirect } from '../../../utils/redirect'
import { normalizePhone, validateFullName, validatePhone, validateUsername } from '../../../utils/validators'
import { Button } from '../../../components/common/Button/Button'
import { Input } from '../../../components/common/Input/Input'
import { Loader } from '../../../components/common/Loader/Loader'
import { TermsCheckbox } from '../../../components/auth/TermsCheckbox/TermsCheckbox'
import { UsernameField } from '../../../components/auth/UsernameField/UsernameField'
import { AuthLayout } from '../../../components/layout/AuthLayout/AuthLayout'
import styles from '../authPages.module.css'

export default function CompleteProfile() {
  useDocumentTitle('Completar cadastro', { noindex: true })
  const { user, loading, needsProfileCompletion } = useAuth()
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))

  if (loading) return <Loader fullPage />
  if (!user) return <Navigate to={ROUTES.LOGIN} replace />
  if (!needsProfileCompletion) return <Navigate to={redirect} replace />
  return <CompleteProfileForm redirect={redirect} />
}

// Formulário só monta depois que o profile carregou (estado inicial correto)
function CompleteProfileForm({ redirect }) {
  const { user, profile, setProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [phone, setPhone] = useState(profile?.phone || user?.phone || '')
  const [terms, setTerms] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const onStatus = useCallback((s) => setUsernameStatus(s), [])

  const termsOnly = Boolean(profile?.username && profile?.full_name && profile?.phone)

  const submit = async (e) => {
    e.preventDefault()
    const next = {
      fullName: validateFullName(fullName),
      username: validateUsername(username) || (usernameStatus === 'taken' ? 'Este nome de usuário já está em uso.' : ''),
      phone: validatePhone(phone),
      terms: terms ? '' : 'Você precisa aceitar os Termos e a Política de Privacidade.',
    }
    setErrors(next)
    if (Object.values(next).some(Boolean) || usernameStatus === 'checking') return
    setSaving(true)
    try {
      const updated = await updateMyProfile(user.id, {
        full_name: fullName.trim(),
        username,
        phone: normalizePhone(phone),
        terms_version: TERMS_VERSION,
      })
      setProfile(updated)
      toast.success('Cadastro completo! Bem-vindo(a) ao bloco.')
      navigate(redirect, { replace: true })
    } catch (err) {
      setErrors({ form: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthLayout
      title={termsOnly ? 'Atualizamos nossos termos' : 'Complete seu cadastro'}
      subtitle={termsOnly ? 'Leia e aceite para continuar.' : 'Só mais alguns dados para você participar.'}
      footer={
        <button type="button" onClick={signOut} className={styles.muted}>
          Sair da conta
        </button>
      }
    >
      <form className={styles.form} onSubmit={submit} noValidate>
        {!termsOnly && (
          <>
            <Input label="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" error={errors.fullName} required />
            <UsernameField
              value={username}
              onChange={setUsername}
              onStatusChange={onStatus}
              currentUsername={profile?.username}
              error={errors.username && usernameStatus !== 'available' ? errors.username : ''}
              required
            />
            <Input
              label="Telefone com DDD"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 91234-5678"
              autoComplete="tel"
              error={errors.phone}
              required
            />
          </>
        )}
        <TermsCheckbox checked={terms} onChange={setTerms} error={errors.terms} />
        {errors.form && (
          <p className={styles.info} role="alert">
            {errors.form}
          </p>
        )}
        <Button type="submit" fullWidth size="lg" loading={saving}>
          Continuar
        </Button>
      </form>
    </AuthLayout>
  )
}
