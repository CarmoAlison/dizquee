// Perfis de acesso: listar, criar, duplicar e excluir (sistema protegido)
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { createRole, deleteRole, duplicateRole, getRole, listPermissions, listRoles } from '../../../services/rolesService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'

export default function Roles() {
  const { has } = usePermission()
  const canManage = has(PERMISSIONS.ROLES_MANAGE)
  const toast = useToast()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsync(listRoles, [])
  const [nameModal, setNameModal] = useState(null) // { mode: 'new' | 'duplicate', role? }
  const [toDelete, setToDelete] = useState(null)

  return (
    <>
      <PageHeader
        title="Perfis de acesso"
        description="Defina o que cada perfil pode fazer, módulo por módulo."
        actions={
          canManage && (
            <Button icon="plus" onClick={() => setNameModal({ mode: 'new' })}>
              Novo perfil
            </Button>
          )
        }
      />

      {loading && <Skeleton height={200} />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && data && (
        <ul className={shared.list}>
          {data.map((r) => (
            <li key={r.id} className={shared.row}>
              <div className={shared.rowMain}>
                <Link to={ROUTES.ADMIN_ROLE(r.id)} className={shared.rowTitle}>
                  {r.name}
                </Link>
                <span className={shared.rowMeta}>
                  {r.is_system ? 'Todas as permissões' : `${r.permissionCount} permissões`} · {r.memberCount} pessoa(s)
                  {r.description && ` · ${r.description}`}
                </span>
              </div>
              <div className={shared.rowActions}>
                {r.is_system && <span className={cn(shared.badge, shared.badgeAccent)}>Sistema · protegido</span>}
                <Button to={ROUTES.ADMIN_ROLE(r.id)} variant="secondary" size="sm" icon={canManage && !r.is_system ? 'edit' : 'eye'}>
                  {canManage && !r.is_system ? 'Editar' : 'Ver'}
                </Button>
                {canManage && (
                  <Button variant="ghost" size="sm" iconOnly icon="copy" aria-label={`Duplicar ${r.name}`} onClick={() => setNameModal({ mode: 'duplicate', role: r })} />
                )}
                {canManage && !r.is_system && (
                  <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label={`Excluir ${r.name}`} onClick={() => setToDelete(r)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {nameModal && (
        <RoleNameModal
          title={nameModal.mode === 'new' ? 'Novo perfil' : `Duplicar "${nameModal.role.name}"`}
          initialName={nameModal.mode === 'duplicate' ? `${nameModal.role.name} (cópia)` : ''}
          onClose={() => setNameModal(null)}
          onSubmit={async ({ name, description }) => {
            let created
            if (nameModal.mode === 'new') {
              created = await createRole({ name, description })
            } else {
              const [full, perms] = await Promise.all([getRole(nameModal.role.id), listPermissions()])
              // só copia as permissões que você mesmo tem (a RLS bloquearia as outras)
              const allowed = new Set(perms.filter((p) => has(p.key)).map((p) => p.id))
              created = await duplicateRole(
                { ...full, description: description || full.description, permissionIds: full.permissionIds.filter((pid) => allowed.has(pid)) },
                name,
              )
            }
            toast.success('Perfil criado! Agora marque as permissões.')
            navigate(ROUTES.ADMIN_ROLE(created.id))
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteRole(toDelete.id)
          toast.success('Perfil excluído.')
          reload()
        }}
        title={`Excluir o perfil "${toDelete?.name}"?`}
        description={
          toDelete?.memberCount
            ? `Este perfil está em uso por ${toDelete.memberCount} pessoa(s). Troque o perfil delas antes de excluir.`
            : 'As permissões dele serão apagadas.'
        }
        confirmLabel="Excluir"
      />
    </>
  )
}

function RoleNameModal({ title, initialName = '', onClose, onSubmit }) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (name.trim().length < 2) {
      setError('Dê um nome ao perfil.')
      return
    }
    setSaving(true)
    try {
      await onSubmit({ name, description })
    } catch (err) {
      setError(getErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="role-name-form" loading={saving}>
            Continuar
          </Button>
        </>
      }
    >
      <form id="role-name-form" className={shared.stack} onSubmit={submit} noValidate>
        <Input label="Nome do perfil" value={name} onChange={(e) => setName(e.target.value)} error={error} maxLength={60} placeholder="Ex.: Editor, Moderador, Social Media" required data-autofocus />
        <Input as="textarea" label="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} />
      </form>
    </Modal>
  )
}
