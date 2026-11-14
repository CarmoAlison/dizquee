// Lista de notificações (usada no dropdown do sino e na página /notificacoes)
import { Link } from 'react-router'
import { NOTIFICATION_TEXT } from '../../../constants/notifications'
import { ROUTES } from '../../../constants/routes'
import { useNotifications } from '../../../hooks/useNotifications'
import { cn } from '../../../utils/cn'
import { formatRelative } from '../../../utils/formatDate'
import { Avatar } from '../../common/Avatar/Avatar'
import { Button } from '../../common/Button/Button'
import { EmptyState } from '../../common/EmptyState/EmptyState'
import { ErrorState } from '../../common/ErrorState/ErrorState'
import { Skeleton } from '../../common/Skeleton/Skeleton'
import styles from './NotificationList.module.css'

function linkFor(n) {
  if (n.post_id && n.posts?.slug) return `${ROUTES.POST(n.posts.slug)}${n.comment_id ? '#comentarios' : ''}`
  if (n.story_id) return `${ROUTES.STORIES}?story=${n.story_id}`
  return ROUTES.NOTIFICATIONS
}

function excerpt(n) {
  const text = n.comments?.content || n.story_comments?.content
  if (text) return `“${text.length > 80 ? `${text.slice(0, 80)}…` : text}”`
  if (n.posts?.title) return n.posts.title
  return ''
}

export function NotificationList({ compact = false, onNavigate, limit }) {
  const { items, loading, error, hasMore, loadMore, markRead, markAllRead, unread, refresh } = useNotifications()
  const list = limit ? items.slice(0, limit) : items

  if (loading && !items.length) {
    return (
      <div className={styles.list} aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.skeletonRow}>
            <Skeleton variant="circle" width={40} height={40} />
            <div className={styles.skeletonText}>
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="40%" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error && !items.length) return <ErrorState error={error} onRetry={refresh} compact />

  if (!items.length) {
    return (
      <EmptyState
        compact
        icon="bell"
        title="Nada por aqui ainda"
        description="Quando alguém curtir, comentar ou responder você, avisaremos aqui."
      />
    )
  }

  return (
    <div className={styles.wrapper}>
      {unread > 0 && (
        <div className={styles.toolbar}>
          <Button variant="ghost" size="sm" icon="check" onClick={markAllRead}>
            Marcar todas como lidas
          </Button>
        </div>
      )}
      <ul className={styles.list} role="list">
        {list.map((n) => {
          const name = n.actor?.full_name || n.actor?.username || 'Alguém'
          return (
            <li key={n.id} className={cn(styles.item, !n.read_at && styles.unread, compact && styles.compact)}>
              <Link
                to={linkFor(n)}
                className={styles.link}
                onClick={() => {
                  markRead(n.id)
                  onNavigate?.()
                }}
              >
                <Avatar src={n.actor?.avatar_url} name={name} size={compact ? 36 : 44} />
                <span className={styles.text}>
                  <span>
                    <strong>{name}</strong> {NOTIFICATION_TEXT[n.type] || 'interagiu com você'}
                  </span>
                  {excerpt(n) && <span className={styles.excerpt}>{excerpt(n)}</span>}
                  <span className={styles.time}>{formatRelative(n.created_at)}</span>
                </span>
                {!n.read_at && <span className={styles.dot} aria-label="Não lida" />}
              </Link>
              {!n.read_at && (
                <button type="button" className={styles.markButton} onClick={() => markRead(n.id)}>
                  Marcar como lida
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {!limit && hasMore && (
        <div className={styles.more}>
          <Button variant="secondary" onClick={loadMore}>
            Ver mais
          </Button>
        </div>
      )}
    </div>
  )
}
