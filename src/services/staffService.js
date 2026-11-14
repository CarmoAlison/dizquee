// Equipe interna. A criação passa pela Edge Function create-staff-user
// (service role no servidor; nunca no navegador). A conta já nasce
// confirmada, com a senha definida por quem cadastra.
import { supabase } from './supabaseClient'

export async function listStaff() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, email, avatar_url, is_active, is_banned, role_id, created_at, roles(name, is_system)')
    .eq('is_staff', true)
    .order('full_name')
  if (error) throw error
  return data || []
}

export async function createStaffUser({ email, fullName, roleId, password }) {
  const { data, error } = await supabase.functions.invoke('create-staff-user', {
    body: { email: email.trim(), full_name: fullName.trim(), role_id: roleId, password },
  })
  if (error) {
    // Função não publicada / sem conexão com a função
    if (error.name === 'FunctionsFetchError' || error.context?.status === 404) {
      throw new Error(
        'Não foi possível falar com a função "create-staff-user". Verifique se ela foi publicada em Supabase › Edge Functions.',
      )
    }
    // Mensagem amigável devolvida pela função
    let message = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.error) message = body.error
    } catch {
      /* sem corpo */
    }
    throw new Error(message || 'Não foi possível criar o usuário.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function setStaffActive(id, isActive) {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function changeStaffRole(id, roleId) {
  const { error } = await supabase.from('profiles').update({ role_id: roleId }).eq('id', id)
  if (error) throw error
}

export async function removeFromStaff(id) {
  const { error } = await supabase.from('profiles').update({ is_staff: false, role_id: null }).eq('id', id)
  if (error) throw error
}
