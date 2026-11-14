// Comentários de posts e de stories (mesma interface, tabelas diferentes)
import { attachProfiles } from './profileService'
import { supabase } from './supabaseClient'

const TARGETS = {
  post: { table: 'comments', column: 'post_id' },
  story: { table: 'story_comments', column: 'story_id' },
}

export async function listComments(kind, targetId, limit = 300) {
  const { table, column } = TARGETS[kind]
  const { data, error } = await supabase
    .from(table)
    .select(`id, ${column}, parent_id, user_id, content, created_at`)
    .eq(column, targetId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return attachProfiles(data || [], 'user_id', 'author')
}

export async function addComment(kind, { targetId, userId, content, parentId = null }) {
  const { table, column } = TARGETS[kind]
  const { data, error } = await supabase
    .from(table)
    .insert({ [column]: targetId, user_id: userId, content: content.trim(), parent_id: parentId })
    .select(`id, ${column}, parent_id, user_id, content, created_at`)
    .single()
  if (error) throw error
  const [comment] = await attachProfiles([data], 'user_id', 'author')
  return comment
}

export async function deleteComment(kind, id) {
  const { table } = TARGETS[kind]
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para excluir este comentário.')
}

// Agrupa em raízes + respostas (1 nível)
export function buildThreads(comments) {
  const roots = []
  const replies = {}
  for (const c of comments) {
    if (c.parent_id) {
      ;(replies[c.parent_id] ||= []).push(c)
    } else {
      roots.push(c)
    }
  }
  return roots.map((root) => ({ ...root, replies: replies[root.id] || [] }))
}
