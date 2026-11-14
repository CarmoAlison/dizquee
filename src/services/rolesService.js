// Perfis de acesso (roles) e matriz de permissões
import { supabase } from './supabaseClient'

export async function listRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, description, is_system, created_at, role_permissions(count), profiles(count)')
    .order('is_system', { ascending: false })
    .order('name')
  if (error) throw error
  return (data || []).map((r) => ({
    ...r,
    permissionCount: r.role_permissions?.[0]?.count ?? 0,
    memberCount: r.profiles?.[0]?.count ?? 0,
  }))
}

export async function listPermissions() {
  const { data, error } = await supabase.from('permissions').select('id, key, module, description').order('module').order('key')
  if (error) throw error
  return data || []
}

export async function getRole(id) {
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, description, is_system, created_at, role_permissions(permission_id)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { ...data, permissionIds: (data.role_permissions || []).map((rp) => rp.permission_id) }
}

export async function createRole({ name, description }) {
  const { data, error } = await supabase
    .from('roles')
    .insert({ name: name.trim(), description: description?.trim() || null, is_system: false })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function updateRole(id, { name, description }) {
  const { error } = await supabase
    .from('roles')
    .update({ name: name.trim(), description: description?.trim() || null })
    .eq('id', id)
  if (error) throw error
}

export async function deleteRole(id) {
  const { error, count } = await supabase.from('roles').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Este perfil não pode ser excluído.')
}

// Aplica a diferença entre as permissões antigas e as novas
export async function saveRolePermissions(roleId, newIds, oldIds) {
  const toAdd = newIds.filter((id) => !oldIds.includes(id))
  const toRemove = oldIds.filter((id) => !newIds.includes(id))
  if (toRemove.length) {
    const { error } = await supabase.from('role_permissions').delete().eq('role_id', roleId).in('permission_id', toRemove)
    if (error) throw error
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from('role_permissions')
      .insert(toAdd.map((permission_id) => ({ role_id: roleId, permission_id })))
    if (error) throw error
  }
}

export async function duplicateRole(role, newName) {
  const created = await createRole({ name: newName, description: role.description })
  if (role.permissionIds?.length) {
    await saveRolePermissions(created.id, role.permissionIds, [])
  }
  return created
}
