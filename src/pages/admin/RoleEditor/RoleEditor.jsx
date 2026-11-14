// Editor de perfil de acesso: nome, descrição e matriz de permissões por módulo.
// Perfis de sistema ficam só para leitura. Ninguém concede permissão que não tem
// (garantido pela RLS; aqui as caixas ficam desabilitadas).
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { MODULE_LABELS, PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { getRole, listPermissions, saveRolePermissions, updateRole } from '../../../services/rolesService'
import { getErrorMessage } from '../../../utils/errors'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { Checkbox } from '../../../components/common/Checkbox/Checkbox'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Loader } from '../../../components/common/Loader/Loader'
import shared from '../adminShared.module.css'
import styles from './RoleEditor.module.css'

export default function RoleEditor() {
  const { id } = useParams()
  const { data, loading, error, reload } = useAsync(async () => {
    const [role, permissions] = await Promise.all([getRole(id), listPermissions()])
    return { role, permissions }
  }, [id])

  if (loading) return <Loader fullPage />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data?.role) return <EmptyState icon="key" title="Perfil não encontrado" action={<Button to={ROUTES.ADMIN_ROLES}>Voltar</Button>} />
  return <RoleForm key={data.role.id} role={data.role} permissions={data.permissions} onSaved={reload} />
}

function RoleForm({ role, permissions, onSaved }) {
  const { has } = usePermission()
  const toast = useToast()
  const canManage = has(PERMISSIONS.ROLES_MANAGE)
  const readOnly = role.is_system || !canManage
  const [name, setName] = useState(role.name)
  const [description, setDescription] = useState(role.description || '')
  const [selected, setSelected] = useState(() => new Set(role.is_system ? permissions.map((p) => p.id) : role.permissionIds))
  const [saving, setSaving] = useState(false)

  const modules = useMemo(() => {
    const groups = {}
    for (const p of permissions) (groups[p.module] ||= []).push(p)
    return Object.entries(groups)
  }, [permissions])

  // Só dá para marcar/desmarcar o que você mesmo tem (evita escalada)
  const canToggle = (perm) => !readOnly && has(perm.key)

  const toggle = (perm) => {
    if (!canToggle(perm)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(perm.id)) next.delete(perm.id)
      else next.add(perm.id)
      return next
    })
  }

  const toggleModule = (perms, value) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const p of perms) {
        if (!canToggle(p)) continue
        if (value) next.add(p.id)
        else next.delete(p.id)
      }
      return next
    })
  }

  const save = async () => {
    if (name.trim().length < 2) {
      toast.error('Dê um nome ao perfil.')
      return
    }
    setSaving(true)
    try {
      await updateRole(role.id, { name, description })
      await saveRolePermissions(role.id, [...selected], role.permissionIds)
      toast.success('Perfil salvo!')
      onSaved()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title={role.is_system ? `${role.name} (sistema)` : name || 'Perfil'}
        description={role.is_system ? 'Perfil protegido: tem todas as permissões e não pode ser alterado.' : `${selected.size} permissões marcadas`}
        actions={
          <Button to={ROUTES.ADMIN_ROLES} variant="ghost" icon="arrowLeft">
            Perfis
          </Button>
        }
      />

      <div className={shared.stack}>
        <section className={shared.card}>
          <div className={shared.formGrid}>
            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} maxLength={60} />
            <Input label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} maxLength={300} />
          </div>
        </section>

        <div className={styles.matrix}>
          {modules.map(([module, perms]) => {
            const all = perms.every((p) => selected.has(p.id))
            return (
              <fieldset key={module} className={styles.module}>
                <legend className={styles.legend}>{MODULE_LABELS[module] || module}</legend>
                {!readOnly && (
                  <button type="button" className={styles.toggleAll} onClick={() => toggleModule(perms, !all)}>
                    {all ? 'Desmarcar todas' : 'Marcar todas'}
                  </button>
                )}
                {perms.map((p) => (
                  <Checkbox
                    key={p.id}
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p)}
                    disabled={!canToggle(p)}
                    label={p.description || p.key}
                    description={p.key}
                  />
                ))}
              </fieldset>
            )
          })}
        </div>

        {!readOnly && (
          <div className={styles.saveBar}>
            <p className={shared.muted}>Permissões que você não tem aparecem bloqueadas.</p>
            <Button onClick={save} loading={saving} size="lg">
              Salvar perfil
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
