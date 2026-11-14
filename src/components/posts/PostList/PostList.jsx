// Lista do feed com scroll infinito, skeletons, vazio e erro
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll'
import { Button } from '../../common/Button/Button'
import { EmptyState } from '../../common/EmptyState/EmptyState'
import { ErrorState } from '../../common/ErrorState/ErrorState'
import { Skeleton } from '../../common/Skeleton/Skeleton'
import { PostCard } from '../PostCard/PostCard'
import styles from './PostList.module.css'

export function PostCardSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skeletonHeader}>
        <Skeleton variant="circle" width={40} height={40} />
        <div className={styles.skeletonLines}>
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="20%" />
        </div>
      </div>
      <Skeleton height={0} style={{ aspectRatio: '1', borderRadius: 0 }} />
      <div className={styles.skeletonLines} style={{ padding: 16 }}>
        <Skeleton variant="text" width="70%" height={20} />
        <Skeleton variant="text" width="95%" />
        <Skeleton variant="text" width="60%" />
      </div>
    </div>
  )
}

export function PostList({ posts, loading, error, hasMore, onLoadMore, onRetry, onUpdate, categoriesById, emptyAction }) {
  const sentinelRef = useInfiniteScroll(onLoadMore, { hasMore, loading })

  if (error && !posts.length) return <ErrorState error={error} onRetry={onRetry} />

  if (!loading && !posts.length) {
    return (
      <EmptyState
        icon="posts"
        title="Nenhum post por aqui ainda"
        description="Assim que o bloco publicar novidades, elas aparecem aqui."
        action={emptyAction}
      />
    )
  }

  return (
    <div className={styles.list} aria-busy={loading || undefined}>
      {posts.map((post, i) => (
        <PostCard key={post.id} post={post} onUpdate={onUpdate} categoriesById={categoriesById} priority={i === 0} />
      ))}
      {loading && (
        <>
          <PostCardSkeleton />
          {!posts.length && <PostCardSkeleton />}
        </>
      )}
      {error && posts.length > 0 && (
        <div className={styles.retry}>
          <Button variant="secondary" icon="refresh" onClick={onLoadMore}>
            Tentar carregar mais
          </Button>
        </div>
      )}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      {!hasMore && posts.length > 0 && <p className={styles.end}>Você viu todas as novidades 🎉</p>}
    </div>
  )
}
