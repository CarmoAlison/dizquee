// Cadastro completo: nome, usuário único, e-mail, telefone, senha, foto e aceite LGPD
import { useCallback, useState } from 'react'
import { TERMS_VERSION } from '../../../constants/legal'
import { signUpWithEmail } from '../../../services/authService'
import { savePendingAvatar, updateMyProfile, uploadAvatar } from '../../../services/profileService'
import { getErrorMessage } from '../../../utils/errors'
import {
  normalizePhone,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhone,
  validateUsername,
} from '../../../utils/validators'
import { Button } from '../../common/Button/Button'
import { Input } from '../../common/Input/Input'
import { AvatarPicker } from '../AvatarPicker/AvatarPicker'
import { PasswordInput } from '../PasswordInput/PasswordInput'
import { TermsCheckbox } from '../TermsCheckbox/TermsCheckbox'
import { UsernameField } from '../UsernameField/UsernameField'
import styles from '../LoginForm/LoginForm.module.css'

/** onDone({ needsConfirmation, email }) */
export function RegisterForm({ onDone }) {
  const [values, setValues] = useState({ fullName: '', username: '', email: '', phone: '', password: '' })
  const [avatar, setAvatar] = useState(null)
  const [terms, setTerms] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))
  const onUsernameStatus = useCallback((s) => setUsernameStatus(s), [])

  const validate = () => {
    const next = {
      fullName: validateFullName(values.fullName),
      username: validateUsername(values.username) || (usernameStatus === 'taken' ? 'Este nome de usuário já está em uso.' : ''),
      email: validateEmail(values.email),
      phone: validatePhone(values.phone),
      password: validatePassword(values.password),
      terms: terms ? '' : 'Você precisa aceitar os Termos e a Política de Privacidade.',
    }
    setErrors(next)
    return !Object.values(next).some(Boolean)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    if (usernameStatus === 'checking') {
      setFormError('Aguarde a verificação do nome de usuário.')
      return
    }
    setLoading(true)
    setFormError('')
    try {
      const { session, user } = await signUpWithEmail({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        username: values.username,
        phone: normalizePhone(values.phone),
        termsVersion: TERMS_VERSION,
      })
      if (session && user && avatar) {
        // confirmação de e-mail desativada: já está logado
        try {
          const url = await uploadAvatar(user.id, avatar)
          await updateMyProfile(user.id, { avatar_url: url })
        } catch {
          /* a foto pode ser enviada depois no perfil */
        }
      } else if (avatar) {
        await savePendingAvatar(values.email, avatar)
      }
      onDone?.({ needsConfirmation: !session, email: values.email })
    } catch (err) {
      setFormError(getErrorMessage(err, 'Não foi possível criar sua conta.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <AvatarPicker name={values.fullName} onChange={setAvatar} />
      <Input label="Nome completo" value={values.fullName} onChange={set('fullName')} autoComplete="name" error={errors.fullName} maxLength={80} required />
      <UsernameField
        value={values.username}
        onChange={(username) => setValues((v) => ({ ...v, username }))}
        onStatusChange={onUsernameStatus}
        error={errors.username && usernameStatus !== 'available' ? errors.username : ''}
        required
      />
      <Input label="E-mail" type="email" value={values.email} onChange={set('email')} autoComplete="email" inputMode="email" error={errors.email} required />
      <Input
        label="Telefone com DDD"
        type="tel"
        value={values.phone}
        onChange={set('phone')}
        placeholder="(11) 91234-5678"
        autoComplete="tel"
        inputMode="tel"
        error={errors.phone}
        required
      />
      <PasswordInput
        label="Senha"
        value={values.password}
        onChange={set('password')}
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres, com letras e números."
        error={errors.password}
        required
      />
      <TermsCheckbox checked={terms} onChange={setTerms} error={errors.terms} />
      {formError && (
        <div className={styles.formError} role="alert">
          {formError}
        </div>
      )}
      <Button type="submit" fullWidth size="lg" loading={loading}>
        Criar minha conta
      </Button>
    </form>
  )
}
