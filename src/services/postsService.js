// Posts: feed público, detalhe, CRUD do admin, mídia e realtime de contadores
import { slugSuffix, slugify } from '../utils/slugify'
import { attachProfiles } from './profileService'
import { BUCKETS, removeFiles } from './storageService'
import { supabase } from './supabaseClient'

const EMBED = 'post_media(id, type, storage_path, position, width, height, duration), post_categories(category_id)'
const POST_FIELDS = `id, title, slug, content, author_id, status, published_at, like_count, comment_count, created_at, updated_at, ${EMBED}`

function normalizePost(post) {
  if (!post) return post
  return {
    ...post,
    media: [...(post.post_media || [])].sort((a, b) => a.position - b.position),
    categoryIds: (post.post_categories || []).map((pc) => pc.category_id),
  }
}

// ---------------------------------------------------------------------
// Público
// ---------------------------------------------------------------------

/** Feed com paginação por cursor { published_at, id } */
export async function getFeed({ categoryId = null, cursor = null, limit = 8 } = {}) {
  const { data, error } = await supabase
    .rpc('get_feed', {
      p_category_id: categoryId,
      p_before_published: cursor?.published_at ?? null,
      p_before_id: cursor?.id ?? null,
      p_limit: limit,
    })
    .select(POST_FIELDS)
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  const posts = await attachProfiles((data || []).map(normalizePost), 'author_id', 'author')
  const last = posts[posts.length - 1]
  return {
    posts,
    nextCursor: posts.length === limit && last ? { published_at: last.published_at, id: last.id } : null,
  }
}

export async function getPostBySlug(slug) {
  const { data, error } = await supabase.from('posts').select(POST_FIELDS).eq('slug', slug).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [post] = await attachProfiles([normalizePost(data)], 'author_id', 'author')
  return post
}

// IDs que o usuário logado curtiu (entre os informados)
export async function getMyLikedPostIds(userId, postIds) {
  if (!userId || !postIds?.length) return new Set()
  const { data, error } = await supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds)
  if (error) throw error
  return new Set((data || []).map((r) => r.post_id))
}

export async function likePost(postId, userId) {
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function unlikePost(postId, userId) {
  const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
  if (error) throw error
}

/**
 * Realtime dos contadores (curtidas/comentários).
 * Sem postId: escuta todos os posts (feed). Retorna função para cancelar.
 */
export function subscribePostCounters(onChange, postId = null) {
  const channel = supabase
    .channel(`post-counters-${postId || 'feed'}-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'posts', ...(postId ? { filter: `id=eq.${postId}` } : {}) },
      (payload) => {
        const { id, like_count, comment_count } = payload.new || {}
        if (id) onChange({ id, like_count, comment_count })
      },
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------
export async function listAdminPosts({ status = '', categoryId = '', search = '', page = 0, pageSize = 20 } = {}) {
  const embed = categoryId
    ? 'post_media(id, type, storage_path, position), post_categories!inner(category_id)'
    : 'post_media(id, type, storage_path, position), post_categories(category_id)'
  let query = supabase
    .from('posts')
    .select(`id, title, slug, author_id, status, published_at, like_count, comment_count, created_at, updated_at, ${embed}`, {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (status) query = query.eq('status', status)
  if (categoryId) query = query.eq('post_categories.category_id', categoryId)
  if (search.trim()) query = query.ilike('title', `%${search.trim()}%`)
  const { data, error, count } = await query
  if (error) throw error
  const posts = await attachProfiles((data || []).map(normalizePost), 'author_id', 'author')
  return { posts, total: count || 0 }
}

export async function getPostById(id) {
  const { data, error } = await supabase.from('posts').select(POST_FIELDS).eq('id', id).maybeSingle()
  if (error) throw error
  return normalizePost(data)
}

/** Cria sempre como rascunho; a publicação acontece depois da mídia. */
export async function createPost({ title, slug, content, authorId, publishedAt }) {
  const base = slugify(slug || title) || `post-${slugSuffix()}`
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 170)}-${slugSuffix()}`
    const { data, error } = await supabase
      .from('posts')
      .insert({
        title: title.trim(),
        slug: candidate,
        content: content || '',
        author_id: authorId,
        status: 'draft',
        published_at: publishedAt || null,
      })
      .select('id, slug')
      .single()
    if (!error) return data
    if (!(error.code === '23505' && /slug/.test(error.message))) throw error
  }
  throw new Error('Não foi possível gerar um endereço único para o post.')
}

export async function updatePost(id, { title, slug, content, publishedAt }) {
  const { error } = await supabase
    .from('posts')
    .update({ title: title.trim(), slug: slugify(slug || title), content: content || '', published_at: publishedAt || null })
    .eq('id', id)
  if (error) throw error
}

export async function setPostStatus(id, status) {
  const fields = { status }
  const { error } = await supabase.from('posts').update(fields).eq('id', id)
  if (error) throw error
}

export async function setPostCategories(postId, categoryIds, previousIds = []) {
  const toAdd = categoryIds.filter((id) => !previousIds.includes(id))
  const toRemove = previousIds.filter((id) => !categoryIds.includes(id))
  if (toRemove.length) {
    const { error } = await supabase.from('post_categories').delete().eq('post_id', postId).in('category_id', toRemove)
    if (error) throw error
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from('post_categories')
      .insert(toAdd.map((category_id) => ({ post_id: postId, category_id })))
    if (error) throw error
  }
}

export async function insertPostMedia(postId, item) {
  const { data, error } = await supabase
    .from('post_media')
    .insert({
      post_id: postId,
      type: item.type,
      storage_path: item.storage_path,
      position: item.position,
      width: item.width || null,
      height: item.height || null,
      duration: item.duration || null,
    })
    .select('id, type, storage_path, position, width, height, duration')
    .single()
  if (error) throw error
  return data
}

export async function updateMediaPositions(items) {
  const results = await Promise.all(
    items.map((m) => supabase.from('post_media').update({ position: m.position }).eq('id', m.id)),
  )
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}

export async function deletePostMedia(items) {
  if (!items?.length) return
  const { error } = await supabase
    .from('post_media')
    .delete()
    .in('id', items.map((m) => m.id))
  if (error) throw error
  try {
    await removeFiles(BUCKETS.POST_MEDIA, items.map((m) => m.storage_path))
  } catch {
    /* arquivo órfão não impede a edição */
  }
}

export async function deletePost(post) {
  const { error } = await supabase.from('posts').delete().eq('id', post.id)
  if (error) throw error
  try {
    await removeFiles(BUCKETS.POST_MEDIA, (post.media || post.post_media || []).map((m) => m.storage_path))
  } catch {
    /* arquivos órfãos podem ser limpos manualmente no Storage */
  }
}

export function buildMediaPath(postId, extension) {
  return `posts/${postId}/${crypto.randomUUID()}.${extension}`
}
