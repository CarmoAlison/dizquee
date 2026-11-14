// Detalhe de um post por slug (+ curtida do usuário e contadores em tempo real)
import { useCallback, useEffect, useState } from 'react'
import { getMyLikedPostIds, getPostBySlug, subscribePostCounters } from '../services/postsService'
import { useAuth } from './useAuth'

export function usePost(slug) {
  const { user } = useAuth()
  const userId = user?.id
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPostBySlug(slug)
      if (data) {
        const liked = await getMyLikedPostIds(userId, [data.id])
        setPost({ ...data, liked: liked.has(data.id) })
      } else {
        setPost(null)
      }
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [slug, userId])

  useEffect(() => {
    load()
  }, [load])

  const postId = post?.id
  useEffect(() => {
    if (!postId) return undefined
    return subscribePostCounters(
      ({ like_count, comment_count }) => setPost((p) => (p ? { ...p, like_count, comment_count } : p)),
      postId,
    )
  }, [postId])

  const updatePost = useCallback((patch) => setPost((p) => (p ? { ...p, ...patch } : p)), [])

  return { post, loading, error, reload: load, updatePost }
}
