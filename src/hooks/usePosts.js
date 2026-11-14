// Feed com scroll infinito (cursor), curtidas do usuário e contadores em tempo real
import { useCallback, useEffect, useRef, useState } from 'react'
import { getFeed, getMyLikedPostIds, subscribePostCounters } from '../services/postsService'
import { useAuth } from './useAuth'

const PAGE_SIZE = 8

export function usePosts(categoryId = null, { enabled = true } = {}) {
  const { user } = useAuth()
  const userId = user?.id
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const cursorRef = useRef(null)
  const requestRef = useRef(0)
  const loadingRef = useRef(false)

  const loadPage = useCallback(
    async ({ reset = false } = {}) => {
      const requestId = ++requestRef.current
      if (reset) cursorRef.current = null
      loadingRef.current = true
      setLoading(true)
      setError(null)
      try {
        const { posts: page, nextCursor } = await getFeed({ categoryId, cursor: cursorRef.current, limit: PAGE_SIZE })
        const liked = await getMyLikedPostIds(userId, page.map((p) => p.id))
        if (requestId !== requestRef.current) return
        const withLiked = page.map((p) => ({ ...p, liked: liked.has(p.id) }))
        setPosts((prev) => (reset ? withLiked : [...prev, ...withLiked.filter((p) => !prev.some((x) => x.id === p.id))]))
        cursorRef.current = nextCursor
        setHasMore(Boolean(nextCursor))
      } catch (e) {
        if (requestId === requestRef.current) setError(e)
      } finally {
        if (requestId === requestRef.current) {
          loadingRef.current = false
          setLoading(false)
        }
      }
    },
    [categoryId, userId],
  )

  useEffect(() => {
    if (!enabled) return
    setPosts([])
    setHasMore(true)
    loadPage({ reset: true })
  }, [loadPage, enabled])

  // Contadores em tempo real
  useEffect(
    () =>
      subscribePostCounters(({ id, like_count, comment_count }) =>
        setPosts((list) => list.map((p) => (p.id === id ? { ...p, like_count, comment_count } : p))),
      ),
    [],
  )

  const loadMore = useCallback(() => {
    if (!loadingRef.current && cursorRef.current) loadPage()
  }, [loadPage])

  const updatePost = useCallback(
    (id, patch) => setPosts((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [],
  )

  return { posts, loading, error, hasMore, loadMore, reload: () => loadPage({ reset: true }), updatePost }
}
