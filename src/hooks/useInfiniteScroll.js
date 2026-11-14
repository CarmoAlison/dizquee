// Chama onLoadMore quando o "sentinela" aparece na tela
import { useEffect, useRef } from 'react'

export function useInfiniteScroll(onLoadMore, { hasMore, loading, rootMargin = '600px' } = {}) {
  const sentinelRef = useRef(null)
  const callbackRef = useRef(onLoadMore)

  useEffect(() => {
    callbackRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loading) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) callbackRef.current?.()
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loading, rootMargin])

  return sentinelRef
}
