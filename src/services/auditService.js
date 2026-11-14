// Log de auditoria (somente leitura, audit.view)
import { attachProfiles } from './profileService'
import { supabase } from './supabaseClient'

export async function listAuditLogs({ action = '', entity = '', search = '', from = '', to = '', page = 0, pageSize = 30 } = {}) {
  let query = supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity, entity_id, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (action) query = query.like('action', `${action}%`)
  if (entity) query = query.eq('entity', entity)
  if (from) query = query.gte('created_at', new Date(`${from}T00:00:00`).toISOString())
  if (to) query = query.lte('created_at', new Date(`${to}T23:59:59`).toISOString())
  const term = search.trim().replace(/[%,()"]/g, ' ')
  if (term) query = query.ilike('metadata->>label', `%${term}%`)
  const { data, error, count } = await query
  if (error) throw error
  const logs = await attachProfiles(data || [], 'actor_id', 'actor')
  return { logs, total: count || 0 }
}
