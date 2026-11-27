// Perfil do usuário: editar nome, usuário, telefone e foto; sair; excluir conta (LGPD)
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAuth } from '../../../hooks/useAuth'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { updatePassword } from '../../../services/authService'
import { deleteMyAccount, updateMyProfile, uploadAvatar } from '../../../services/profileService'
import { getErrorMessage } from '../../../utils/errors'
import { formatLongDate } from '../../../utils/formatDate'
import {
  formatPhone,
  normalizePhone,
  validateFullName,
  validatePassword,
  validatePhone,
  validateUsername,
} from '../../../utils/validators'
import { PasswordInput } from '../../../components/auth/PasswordInput/PasswordInput'
import { AvatarPicker } from '../../../components/auth/AvatarPicker/AvatarPicker'
import { UsernameField } from '../../../components/auth/UsernameField/UsernameField'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { Input } from '../../../components/common/Input/Input'
import { Loader } from '../../../components/common/Loader/Loader'
import { ThemeToggle } from '../../../components/common/ThemeToggle/ThemeToggle'
import styles from './Profile.module.css'

export default function Profile() {
  useDocumentTitle('Meu perfil', { noindex: true })
  const { profile } = useAuth()
  if (!profile) return <Loader fullPage />
  return <ProfileContent key={profile.id} />
}

function ProfileContent() {
  const { user, profile, setProfile, signOut, isBanned } = useAuth()
  const { canAccessAdmin } = usePermission()
  const toast = useToast()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState(profile.full_name || '')
  const [username, setUsername] = useState(profile.username || '')
  const [phone, setPhone] = useState(formatPhone(profile.phone) || '')
  const [avatarBlob, setAvatarBlob] = useState(null)
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const onStatus = useCallback((s) => setUsernameStatus(s), [])

  const save = async (e) => {
    e.preventDefault()
    const next = {
      fullName: validateFullName(fullName),
      username: validateUsername(username) || (usernameStatus === 'taken' ? 'Este nome de usuário já está em uso.' : ''),
      phone: validatePhone(phone),
    }
    setErrors(next)
    if (Object.values(next).some(Boolean) || usernameStatus === 'checking') return
    setSaving(true)
    try {
      const fields = { full_name: fullName.trim(), username, phone: normalizePhone(phone) }
      if (avatarBlob) fields.avatar_url = await uploadAvatar(user.id, avatarBlob)
      const updated = await updateMyProfile(user.id, fields)
      setProfile(updated)
      setAvatarBlob(null)
      toast.success('Perfil atualizado!')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate(ROUTES.HOME)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleDelete = async () => {
    await deleteMyAccount(user.id)
    toast.success('Sua conta e seus dados foram excluídos.')
    navigate(ROUTES.HOME, { replace: true })
  }

  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>Meu perfil</h1>

      <section className={styles.card} aria-labelledby="dados">
        <h2 id="dados" className={styles.cardTitle}>
          Seus dados
        </h2>
        <form className={styles.form} onSubmit={save} noValidate>
          <AvatarPicker currentUrl={profile.avatar_url} name={fullName} onChange={setAvatarBlob} label="Foto de perfil" />
          <Input label="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} autoComplete="name" disabled={isBanned} />
          <UsernameField
            value={username}
            onChange={setUsername}
            onStatusChange={onStatus}
            currentUsername={profile.username}
            error={errors.username && usernameStatus !== 'available' ? errors.username : ''}
            disabled={isBanned}
          />
          <Input label="Telefone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} autoComplete="tel" disabled={isBanned} />
          <Input label="E-mail" value={profile.email || user?.email || '—'} readOnly disabled hint="O e-mail é o da sua conta de acesso." />
          <Button type="submit" loading={saving} disabled={isBanned}>
            Salvar alterações
          </Button>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="preferencias">
        <h2 id="preferencias" className={styles.cardTitle}>
          Preferências
        </h2>
        <div className={styles.row}>
          <ThemeToggle withLabel />
          <Button to={ROUTES.MY_ORDERS} variant="secondary" icon="bag">
            Meus pedidos
          </Button>
          {canAccessAdmin && (
            <Button to={ROUTES.ADMIN} variant="secondary" icon="dashboard">
              Painel administrativo
            </Button>
          )}
          <Button variant="ghost" icon="logout" onClick={handleSignOut}>
            Sair
          </Button>
        </div>
        <p className={styles.muted}>
          Conta criada em {formatLongDate(profile.created_at)}. Termos aceitos em {formatLongDate(profile.terms_accepted_at)} (versão{' '}
          {profile.terms_version}).
        </p>
      </section>

      {user?.email && <ChangePassword />}

      <section className={`${styles.card} ${styles.danger}`} aria-labelledby="excluir">
        <h2 id="excluir" className={styles.cardTitle}>
          Excluir minha conta
        </h2>
        <p className={styles.muted}>
          Seus dados pessoais, curtidas, comentários, reações e notificações serão apagados de forma permanente (LGPD).
        </p>
        <Button variant="danger" icon="trash" onClick={() => setDeleteOpen(true)}>
          Excluir conta e dados
        </Button>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false)
          setConfirmText('')
        }}
        onConfirm={handleDelete}
        title="Excluir sua conta?"
        description="Esta ação não pode ser desfeita. Para confirmar, digite EXCLUIR abaixo."
        confirmLabel="Excluir definitivamente"
        confirmDisabled={confirmText !== 'EXCLUIR'}
      >
        <Input label="Digite EXCLUIR" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
      </ConfirmDialog>
    </div>
  )
}

// Trocar a senha (ex.: senha inicial criada pela coordenação)
function ChangePassword() {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const next = {
      password: validatePassword(password),
      confirm: password !== confirm ? 'As senhas não conferem.' : '',
    }
    setErrors(next)
    if (next.password || next.confirm) return
    setSaving(true)
    try {
      await updatePassword(password)
      setPassword('')
      setConfirm('')
      toast.success('Senha alterada!')
    } catch (err) {
      setErrors({ password: getErrorMessage(err, 'Não foi possível alterar a senha.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.card} aria-labelledby="senha">
      <h2 id="senha" className={styles.cardTitle}>
        Trocar senha
      </h2>
      <form className={styles.form} onSubmit={submit} noValidate>
        <PasswordInput label="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." error={errors.password} />
        <PasswordInput label="Confirme a nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" error={errors.confirm} />
        <Button type="submit" variant="secondary" loading={saving}>
          Salvar nova senha
        </Button>
      </form>
    </section>
  )
}
