// Notificações dentro do site (lista, contador, realtime, marcar como lida)
import { attachProfiles } from './profileService'
import { supabase } from './supabaseClient'

const FIELDS =
  'id, type, actor_id, post_id, story_id, comment_id, story_comment_id, order_id, meta, read_at, created_at, posts(title, slug), comments(content), story_comments(content)'

export async function listNotifications({ limit = 20, before = null } = {}) {
  let query = supabase.from('notifications').select(FIELDS).order('created_at', { ascending: false }).limit(limit)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) throw error
  return attachProfiles(data || [], 'actor_id', 'actor')
}

export async function getNotification(id) {
  const { data, error } = await supabase.from('notifications').select(FIELDS).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [n] = await attachProfiles([data], 'actor_id', 'actor')
  return n
}

export async function countUnread() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw error
  return count || 0
}

export async function markAsRead(id) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function markAllAsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  if (error) throw error
}

export function subscribeNotifications(userId, { onInsert, onDelete }) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert?.(payload.new),
    )
    // DELETE não aceita filtro no Realtime; chega só o id (o hook ignora ids desconhecidos)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, (payload) =>
      onDelete?.(payload.old),
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}
