// Destaques (coleções permanentes de stories)
import { BUCKETS, getPublicUrl, removeFiles } from './storageService'
import { supabase } from './supabaseClient'

export async function listHighlights() {
  const { data, error } = await supabase
    .from('highlights')
    .select('id, title, cover_path, position, created_at, stories(count)')
    .order('position')
    .order('created_at')
  if (error) throw error
  return (data || []).map((h) => ({ ...h, storyCount: h.stories?.[0]?.count ?? 0 }))
}

export async function createHighlight({ title, coverPath }) {
  const { data: last } = await supabase
    .from('highlights')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data, error } = await supabase
    .from('highlights')
    .insert({ title: title.trim(), cover_path: coverPath || null, position: (last?.position ?? -1) + 1 })
    .select('id, title, cover_path, position, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updateHighlight(id, { title, coverPath }) {
  const fields = {}
  if (title !== undefined) fields.title = title.trim()
  if (coverPath !== undefined) fields.cover_path = coverPath
  const { error } = await supabase.from('highlights').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteHighlight(highlight) {
  const { error } = await supabase.from('highlights').delete().eq('id', highlight.id)
  if (error) throw error
  if (highlight.cover_path) {
    try {
      await removeFiles(BUCKETS.HIGHLIGHT_COVERS, [highlight.cover_path])
    } catch {
      /* ignora */
    }
  }
}

export async function reorderHighlights(list) {
  const results = await Promise.all(
    list.map((h, index) => supabase.from('highlights').update({ position: index }).eq('id', h.id)),
  )
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}

export async function uploadHighlightCover(blob) {
  const path = `highlights/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from(BUCKETS.HIGHLIGHT_COVERS).upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
  })
  if (error) throw error
  return path
}

export function highlightCoverUrl(highlight, fallbackStory) {
  if (highlight?.cover_path) return getPublicUrl(BUCKETS.HIGHLIGHT_COVERS, highlight.cover_path)
  if (fallbackStory?.media_type === 'image') return getPublicUrl(BUCKETS.STORY_MEDIA, fallbackStory.storage_path)
  return ''
}
