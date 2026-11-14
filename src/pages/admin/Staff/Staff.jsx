// Equipe interna: criar (Edge Function com service role), ativar/desativar,
// trocar perfil de acesso e remover da equipe
import { useState } from 'react'
import { PERMISSIONS } from '../../../constants/permissions'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { listRoles } from '../../../services/rolesService'
import { changeStaffRole, createStaffUser, listStaff, removeFromStaff, setStaffActive } from '../../../services/staffService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { validateEmail, validateFullName, validatePassword } from '../../../utils/validators'
import { copyToClipboard } from '../../../utils/share'
import { PasswordInput } from '../../../components/auth/PasswordInput/PasswordInput'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Avatar } from '../../../components/common/Avatar/Avatar'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'

export default function Staff() {
  const { user: me } = useAuth()
  const { has } = usePermission()
  const toast = useToast()
  const staff = useAsync(listStaff, [])
  const roles = useAsync(listRoles, [], { enabled: has(PERMISSIONS.STAFF_EDIT) || has(PERMISSIONS.STAFF_CREATE) })
  const [createOpen, setCreateOpen] = useState(false)
  const [toRemove, setToRemove] = useState(null)
  const canEdit = has(PERMISSIONS.STAFF_EDIT)

  const run = async (fn, success) => {
    try {
      await fn()
      toast.success(success)
      staff.reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const list = staff.data || []

  return (
    <>
      <PageHeader
        title="Equipe interna"
        description="Pessoas com acesso ao painel e o perfil de acesso de cada uma."
        actions={
          has(PERMISSIONS.STAFF_CREATE) && (
            <Button icon="plus" onClick={() => setCreateOpen(true)}>
              Adicionar pessoa
            </Button>
          )
        }
      />

      {staff.loading && <Skeleton height={240} />}
      {staff.error && <ErrorState error={staff.error} onRetry={staff.reload} />}
      {!staff.loading && !staff.error && list.length === 0 && <EmptyState icon="shield" title="Ninguém na equipe ainda" />}

      {!staff.loading && list.length > 0 && (
        <ul className={shared.list}>
          {list.map((p) => {
            const isMe = p.id === me?.id
            const isSystem = p.roles?.is_system
            return (
              <li key={p.id} className={shared.row}>
                <Avatar src={p.avatar_url} name={p.full_name || p.email} size={44} />
                <div className={shared.rowMain}>
                  <span className={shared.rowTitle}>
                    {p.full_name || 'Sem nome'} {isMe && <span className={shared.rowMeta}>(você)</span>}
                  </span>
                  <span className={shared.rowMeta}>
                    {p.email} ·{' '}
                    <span className={cn(shared.badge, p.is_active ? shared.badgeSuccess : shared.badgeWarning)}>
                      {p.is_active ? 'Ativo' : 'Desativado'}
                    </span>
                    {p.is_banned && <span className={cn(shared.badge, shared.badgeDanger)}> Banido</span>}
                  </span>
                </div>
                <div className={shared.rowActions}>
                  {canEdit && !isMe && roles.data ? (
                    <Input
                      as="select"
                      label={`Perfil de ${p.full_name || p.email}`}
                      hideLabel
                      value={p.role_id || ''}
                      onChange={(e) => run(() => changeStaffRole(p.id, e.target.value), 'Perfil de acesso alterado.')}
                    >
                      {!p.role_id && <option value="">Sem perfil</option>}
                      {roles.data.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Input>
                  ) : (
                    <span className={cn(shared.badge, isSystem && shared.badgeAccent)}>{p.roles?.name || 'Sem perfil'}</span>
                  )}
                  {canEdit && !isMe && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => run(() => setStaffActive(p.id, !p.is_active), p.is_active ? 'Acesso desativado.' : 'Acesso ativado.')}
                    >
                      {p.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                  )}
                  {has(PERMISSIONS.STAFF_DELETE) && !isMe && (
                    <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label={`Remover ${p.full_name} da equipe`} onClick={() => setToRemove(p)} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {createOpen && (
        <CreateStaffModal
          roles={roles.data || []}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setCreateOpen(false)
            toast.success(created ? 'Conta criada! A pessoa já pode entrar com o e-mail e a senha.' : 'Conta existente adicionada à equipe.')
            staff.reload()
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toRemove)}
        onClose={() => setToRemove(null)}
        onConfirm={async () => {
          await removeFromStaff(toRemove.id)
          toast.success('Pessoa removida da equipe.')
          staff.reload()
        }}
        title="Remover da equipe?"
        description={`${toRemove?.full_name || toRemove?.email} perde o acesso ao painel, mas a conta continua existindo como cliente.`}
        confirmLabel="Remover"
      />
    </>
  )
}

// Senha aleatória legível (sem caracteres ambíguos), sempre com letras e números
function generatePassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '23456789'
  const all = letters + digits
  const bytes = crypto.getRandomValues(new Uint32Array(10))
  const chars = [...bytes].map((n, i) => (i === 0 ? letters : i === 1 ? digits : all)[n % (i === 0 ? letters.length : i === 1 ? digits.length : all.length)])
  return chars.sort(() => 0.5 - Math.random()).join('')
}

function CreateStaffModal({ roles, onClose, onCreated }) {
  const toast = useToast()
  const [values, setValues] = useState({ email: '', fullName: '', roleId: '', password: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const next = {
      email: validateEmail(values.email),
      fullName: validateFullName(values.fullName),
      roleId: values.roleId ? '' : 'Escolha um perfil de acesso.',
      password: validatePassword(values.password),
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    setSaving(true)
    try {
      const result = await createStaffUser(values)
      onCreated(result?.created)
    } catch (err) {
      setErrors({ form: getErrorMessage(err, err.message) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Adicionar à equipe"
      description="A conta é criada na hora, sem confirmação por e-mail. Passe o e-mail e a senha para a pessoa; ela pode trocar a senha depois em Meu perfil. Se o e-mail já tiver conta, ela só é promovida (a senha dela não muda)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="staff-form" loading={saving}>
            Cadastrar
          </Button>
        </>
      }
    >
      <form id="staff-form" className={shared.stack} onSubmit={submit} noValidate>
        <Input label="Nome" value={values.fullName} onChange={set('fullName')} error={errors.fullName} required data-autofocus />
        <Input label="E-mail" type="email" value={values.email} onChange={set('email')} error={errors.email} required />
        <PasswordInput
          label="Senha inicial"
          value={values.password}
          onChange={set('password')}
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.password}
          required
        />
        <Button
          variant="secondary"
          size="sm"
          icon="key"
          onClick={async () => {
            const generated = generatePassword()
            setValues((v) => ({ ...v, password: generated }))
            try {
              await copyToClipboard(generated)
              toast.success(`Senha gerada e copiada: ${generated}`, { duration: 8000 })
            } catch {
              toast.info(`Senha gerada: ${generated}`, { duration: 8000 })
            }
          }}
        >
          Gerar senha
        </Button>
        <Input as="select" label="Perfil de acesso" value={values.roleId} onChange={set('roleId')} error={errors.roleId} required>
          <option value="">Escolha…</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Input>
        {errors.form && (
          <p className={cn(shared.badge, shared.badgeDanger)} role="alert" style={{ whiteSpace: 'normal', padding: 12 }}>
            {errors.form}
          </p>
        )}
      </form>
    </Modal>
  )
}
