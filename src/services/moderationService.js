// Moderação de comentários (posts e stories)
import { attachProfiles } from './profileService'
import { supabase } from './supabaseClient'

/** kind: 'post' | 'story' */
export async function listCommentsForModeration({ kind = 'post', search = '', page = 0, pageSize = 25 } = {}) {
  const isPost = kind === 'post'
  let query = supabase
    .from(isPost ? 'comments' : 'story_comments')
    .select(
      isPost
        ? 'id, content, created_at, parent_id, user_id, post_id, posts(title, slug)'
        : 'id, content, created_at, parent_id, user_id, story_id, stories(caption, media_type)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  const term = search.trim()
  if (term) query = query.ilike('content', `%${term.replace(/[%_]/g, '')}%`)
  const { data, error, count } = await query
  if (error) throw error
  const comments = await attachProfiles(data || [], 'user_id', 'author')
  return { comments, total: count || 0 }
}
