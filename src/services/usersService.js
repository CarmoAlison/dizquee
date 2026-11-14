// Clientes (admin): lista, detalhe, histórico e banimento
import { supabase } from './supabaseClient'

const FIELDS =
  'id, full_name, username, email, phone, avatar_url, is_staff, is_active, is_banned, banned_at, banned_reason, role_id, terms_accepted_at, terms_version, created_at'

/**
 * status: '' | 'active' | 'banned' | 'incomplete'
 * type: 'clients' | 'staff' | 'all'
 */
export async function listUsers({ search = '', status = '', type = 'clients', from = '', to = '', page = 0, pageSize = 25 } = {}) {
  let query = supabase
    .from('profiles')
    .select(FIELDS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (type === 'clients') query = query.eq('is_staff', false)
  if (type === 'staff') query = query.eq('is_staff', true)
  if (status === 'active') query = query.eq('is_banned', false)
  if (status === 'banned') query = query.eq('is_banned', true)
  if (status === 'incomplete') query = query.or('username.is.null,terms_accepted_at.is.null')
  if (from) query = query.gte('created_at', new Date(`${from}T00:00:00`).toISOString())
  if (to) query = query.lte('created_at', new Date(`${to}T23:59:59`).toISOString())

  const term = search.trim().replace(/[%,()]/g, ' ')
  if (term) {
    query = query.or(`full_name.ilike.%${term}%,username.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { users: data || [], total: count || 0 }
}

export async function getUser(id) {
  const { data, error } = await supabase.from('profiles').select(FIELDS).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function getUserHistory(userId) {
  const [likes, comments, storyComments] = await Promise.all([
    supabase
      .from('post_likes')
      .select('post_id, created_at, posts(title, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('comments')
      .select('id, content, created_at, parent_id, posts(title, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('story_comments')
      .select('id, content, created_at, parent_id, stories(caption)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])
  for (const r of [likes, comments, storyComments]) if (r.error) throw r.error
  return { likes: likes.data || [], comments: comments.data || [], storyComments: storyComments.data || [] }
}

export async function banUser(id, reason) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: true, banned_reason: reason.trim() })
    .eq('id', id)
  if (error) throw error
}

export async function unbanUser(id) {
  const { error } = await supabase.from('profiles').update({ is_banned: false, banned_reason: null }).eq('id', id)
  if (error) throw error
}
