// Card do feed: autor, mídia, ações, título, trecho do texto e categorias
import { memo } from 'react'
import { useBrand } from '../../../hooks/useBrand'
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { formatLongDate, formatRelative } from '../../../utils/formatDate'
import { Avatar } from '../../common/Avatar/Avatar'
import { Logo } from '../../common/Logo/Logo'
import { PostActions } from '../PostActions/PostActions'
import { PostMediaCarousel } from '../PostMediaCarousel/PostMediaCarousel'
import styles from './PostCard.module.css'

function PostCardComponent({ post, categoriesById = {}, onUpdate, priority = false }) {
  const brand = useBrand()
  const authorName = post.author?.full_name || brand.name
  const categories = (post.categoryIds || []).map((id) => categoriesById[id]).filter(Boolean)
  const update = (patch) => onUpdate(post.id, patch)

  return (
    <article className={styles.card} aria-labelledby={`post-${post.id}-title`}>
      <header className={styles.header}>
        {post.author?.avatar_url ? <Avatar src={post.author.avatar_url} name={authorName} size={40} /> : <Logo variant="mark" size={40} />}
        <div className={styles.meta}>
          <span className={styles.author}>{authorName}</span>
          <time className={styles.time} dateTime={post.published_at} title={formatLongDate(post.published_at)}>
            {formatRelative(post.published_at)}
          </time>
        </div>
      </header>

      {post.media?.length > 0 && (
        <div className={styles.mediaLink}>
          <PostMediaCarousel media={post.media} title={post.title} priority={priority} />
        </div>
      )}

      <div className={styles.body}>
        <PostActions post={post} onUpdate={update} />
        <h2 id={`post-${post.id}-title`} className={styles.title}>
          <Link to={ROUTES.POST(post.slug)}>{post.title}</Link>
        </h2>
        {post.content && <p className={styles.excerpt}>{post.content}</p>}
        {categories.length > 0 && (
          <ul className={styles.categories} role="list" aria-label="Categorias">
            {categories.map((c) => (
              <li key={c.id} className={styles.category} style={c.color ? { '--chip-color': c.color } : undefined}>
                {c.name}
              </li>
            ))}
          </ul>
        )}
        <Link to={ROUTES.POST(post.slug)} className={styles.more}>
          {post.comment_count > 0
            ? `Ver ${post.comment_count === 1 ? 'o comentário' : `os ${post.comment_count} comentários`}`
            : 'Ver post completo'}
        </Link>
      </div>
    </article>
  )
}

export const PostCard = memo(PostCardComponent)
