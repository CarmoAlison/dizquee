// Stories: barra pública, visualizações, curtidas, reações e admin
import { getAnonymousSessionId } from '../utils/session'
import { BUCKETS, removeFiles } from './storageService'
import { supabase } from './supabaseClient'

const STORY_FIELDS =
  'id, author_id, media_type, storage_path, caption, expires_at, is_highlight, highlight_id, width, height, duration, view_count, like_count, comment_count, created_at'

// Stories ativos de 24 h (mais antigos primeiro, como no Instagram)
export async function getActiveStories() {
  const { data, error } = await supabase
    .from('stories')
    .select(STORY_FIELDS)
    .eq('is_highlight', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// Destaques com seus stories
export async function getHighlightsWithStories() {
  const { data, error } = await supabase
    .from('highlights')
    .select(`id, title, cover_path, position, stories(${STORY_FIELDS})`)
    .order('position')
    .order('created_at')
  if (error) throw error
  return (data || [])
    .map((h) => ({
      ...h,
      stories: [...(h.stories || [])].filter((s) => s.is_highlight).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    .filter((h) => h.stories.length > 0)
}

export async function registerStoryView(storyId) {
  const { error } = await supabase.rpc('register_story_view', {
    p_story_id: storyId,
    p_session_id: getAnonymousSessionId(),
  })
  if (error) throw error
}

// Stories que o usuário logado já viu (anel cinza em outros aparelhos)
export async function getMyViewedStoryIds(userId, storyIds) {
  if (!userId || !storyIds?.length) return new Set()
  const { data, error } = await supabase
    .from('story_views')
    .select('story_id')
    .eq('viewer_id', userId)
    .in('story_id', storyIds)
  if (error) throw error
  return new Set((data || []).map((r) => r.story_id))
}

// Curtida e reações do usuário em um story
export async function getMyStoryInteraction(userId, storyId) {
  if (!userId) return { liked: false, reactions: [] }
  const [likes, reactions] = await Promise.all([
    supabase.from('story_likes').select('story_id').eq('user_id', userId).eq('story_id', storyId),
    supabase.from('story_reactions').select('emoji').eq('user_id', userId).eq('story_id', storyId),
  ])
  if (likes.error) throw likes.error
  if (reactions.error) throw reactions.error
  return { liked: (likes.data || []).length > 0, reactions: (reactions.data || []).map((r) => r.emoji) }
}

export async function getReactionCounts(storyId) {
  const { data, error } = await supabase.from('story_reaction_counts').select('emoji, total').eq('story_id', storyId)
  if (error) throw error
  return Object.fromEntries((data || []).map((r) => [r.emoji, r.total]))
}

export async function likeStory(storyId, userId) {
  const { error } = await supabase.from('story_likes').insert({ story_id: storyId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function unlikeStory(storyId, userId) {
  const { error } = await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId)
  if (error) throw error
}

export async function addReaction(storyId, userId, emoji) {
  const { error } = await supabase.from('story_reactions').insert({ story_id: storyId, user_id: userId, emoji })
  if (error && error.code !== '23505') throw error
}

export async function removeReaction(storyId, userId, emoji) {
  const { error } = await supabase
    .from('story_reactions')
    .delete()
    .eq('story_id', storyId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
  if (error) throw error
}

export function subscribeStoryCounters(storyId, onChange) {
  const channel = supabase
    .channel(`story-${storyId}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stories', filter: `id=eq.${storyId}` }, (payload) =>
      onChange(payload.new),
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------

/** filter: 'active' | 'expired' | 'highlights' | '' */
export async function listAdminStories({ filter = '', page = 0, pageSize = 24 } = {}) {
  const now = new Date().toISOString()
  let query = supabase
    .from('stories')
    .select(`${STORY_FIELDS}, highlights(title)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (filter === 'active') query = query.eq('is_highlight', false).gt('expires_at', now)
  if (filter === 'expired') query = query.eq('is_highlight', false).lte('expires_at', now)
  if (filter === 'highlights') query = query.eq('is_highlight', true)
  const { data, error, count } = await query
  if (error) throw error
  return { stories: data || [], total: count || 0 }
}

export async function createStory({ authorId, mediaType, storagePath, caption, isHighlight, highlightId, width, height, duration }) {
  const { data, error } = await supabase
    .from('stories')
    .insert({
      author_id: authorId,
      media_type: mediaType,
      storage_path: storagePath,
      caption: caption?.trim() || null,
      is_highlight: Boolean(isHighlight),
      highlight_id: isHighlight ? highlightId : null,
      // o servidor define a validade de 24 h; este valor só satisfaz o CHECK
      expires_at: isHighlight ? null : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      width: width || null,
      height: height || null,
      duration: duration || null,
    })
    .select(STORY_FIELDS)
    .single()
  if (error) throw error
  return data
}

// Coloca um story em um destaque (ou tira, com highlightId = null)
export async function setStoryHighlight(storyId, highlightId) {
  const { error } = await supabase
    .from('stories')
    .update({ is_highlight: Boolean(highlightId), highlight_id: highlightId || null })
    .eq('id', storyId)
  if (error) throw error
}

export async function deleteStory(story) {
  const { error, count } = await supabase.from('stories').delete({ count: 'exact' }).eq('id', story.id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para excluir este story.')
  try {
    await removeFiles(BUCKETS.STORY_MEDIA, [story.storage_path])
  } catch {
    /* arquivo órfão será removido na limpeza */
  }
}

export async function getStoryStats(storyId) {
  const { data, error } = await supabase.rpc('get_story_stats', { p_story_id: storyId })
  if (error) throw error
  return data
}

export async function getStoryViewers(storyId) {
  const { data, error } = await supabase.rpc('get_story_viewers', { p_story_id: storyId })
  if (error) throw error
  return data || []
}

export function buildStoryPath(extension) {
  return `stories/${crypto.randomUUID()}.${extension}`
}
