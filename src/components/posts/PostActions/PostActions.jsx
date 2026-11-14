// Barra de ações do post: curtir, comentar e compartilhar
import { useCallback } from 'react'
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAuth } from '../../../hooks/useAuth'
import { useLike } from '../../../hooks/useLike'
import { likePost, unlikePost } from '../../../services/postsService'
import { formatCount } from '../../../utils/formatDate'
import { getSiteUrl } from '../../../utils/share'
import { Icon } from '../../common/Icon/Icon'
import { LikeButton } from '../LikeButton/LikeButton'
import { ShareButton } from '../ShareButton/ShareButton'
import styles from './PostActions.module.css'

/** onUpdate(patch) atualiza o post no estado do pai (otimista) */
export function PostActions({ post, onUpdate, onCommentClick }) {
  const { user } = useAuth()
  const like = useCallback(() => likePost(post.id, user.id), [post.id, user])
  const unlike = useCallback(() => unlikePost(post.id, user.id), [post.id, user])
  const toggle = useLike({ item: post, update: onUpdate, like, unlike, reason: 'Entre para curtir este post.' })
  const url = `${getSiteUrl()}${ROUTES.POST(post.slug)}`

  return (
    <div className={styles.actions}>
      <LikeButton liked={post.liked} count={post.like_count} onToggle={toggle} label={post.title} />
      {onCommentClick ? (
        <button type="button" className={styles.action} onClick={onCommentClick} aria-label={`Comentar. ${post.comment_count} comentários`}>
          <Icon name="comment" size={22} />
          <span aria-hidden="true">{formatCount(post.comment_count)}</span>
        </button>
      ) : (
        <Link
          to={`${ROUTES.POST(post.slug)}#comentarios`}
          className={styles.action}
          aria-label={`Ver comentários. ${post.comment_count} comentários`}
        >
          <Icon name="comment" size={22} />
          <span aria-hidden="true">{formatCount(post.comment_count)}</span>
        </Link>
      )}
      <span className={styles.spacer} />
      <ShareButton title={post.title} text={post.title} url={url} />
    </div>
  )
}
