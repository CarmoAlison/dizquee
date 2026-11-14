// Detalhe do post (/post/:slug): mídia, texto completo, curtidas,
// comentários com respostas e compartilhamento. Título dinâmico.
import { useEffect, useMemo } from 'react'
import { useBrand } from '../../../hooks/useBrand'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useCategories } from '../../../hooks/useCategories'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { usePost } from '../../../hooks/usePost'
import { BUCKETS, getPublicUrl } from '../../../services/storageService'
import { formatLongDate } from '../../../utils/formatDate'
import { Button } from '../../../components/common/Button/Button'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Logo } from '../../../components/common/Logo/Logo'
import { Avatar } from '../../../components/common/Avatar/Avatar'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { CommentList } from '../../../components/comments/CommentList/CommentList'
import { PostActions } from '../../../components/posts/PostActions/PostActions'
import { PostMediaCarousel } from '../../../components/posts/PostMediaCarousel/PostMediaCarousel'
import styles from './PostDetails.module.css'

export default function PostDetails() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { post, loading, error, reload, updatePost } = usePost(slug)
  const { categories } = useCategories()
  const brand = useBrand()
  // SEO: descrição (trecho do texto), primeira foto e dados estruturados de artigo
  const seoImage = post?.media?.find((m) => m.type === 'image')
  const seoImageUrl = seoImage ? getPublicUrl(BUCKETS.POST_MEDIA, seoImage.storage_path) : undefined
  const seoDescription = post?.content ? post.content.replace(/s+/g, ' ').slice(0, 157) + (post.content.length > 157 ? '…' : '') : undefined
  useDocumentTitle(post?.title || (loading ? 'Carregando…' : 'Post não encontrado'), {
    description: seoDescription,
    image: seoImageUrl,
    type: post ? 'article' : 'website',
    noindex: !loading && !post,
    jsonLd: post
      ? {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: post.title.slice(0, 110),
          description: seoDescription,
          image: seoImageUrl ? [seoImageUrl] : undefined,
          datePublished: post.published_at,
          dateModified: post.updated_at || post.published_at,
          author: { '@type': 'Organization', name: brand.name },
          publisher: { '@type': 'Organization', name: brand.name },
          mainEntityOfPage: typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined,
        }
      : null,
  })

  const postCategories = useMemo(
    () => categories.filter((c) => post?.categoryIds?.includes(c.id)),
    [categories, post?.categoryIds],
  )

  // Vai direto para os comentários quando a URL tem #comentarios
  useEffect(() => {
    if (post && location.hash === '#comentarios') {
      document.getElementById('comentarios')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [post, location.hash])

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate(ROUTES.HOME))

  if (loading) {
    return (
      <div className={`container ${styles.page}`} aria-busy="true">
        <Skeleton height={0} style={{ aspectRatio: '1', borderRadius: 24 }} />
        <Skeleton variant="text" height={28} width="70%" />
        <Skeleton variant="text" width="95%" />
        <Skeleton variant="text" width="80%" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`container ${styles.page}`}>
        <ErrorState error={error} onRetry={reload} />
      </div>
    )
  }

  if (!post) {
    return (
      <div className={`container ${styles.page}`}>
        <EmptyState
          icon="posts"
          title="Post não encontrado"
          description="Ele pode ter sido removido ou ainda não foi publicado."
          action={<Button to={ROUTES.HOME}>Ver o feed</Button>}
        />
      </div>
    )
  }

  const authorName = post.author?.full_name || brand.name

  return (
    <div className={`container ${styles.page}`}>
      <button type="button" className={styles.back} onClick={goBack}>
        ← Voltar
      </button>

      <article className={styles.article} aria-labelledby="post-title">
        <header className={styles.header}>
          {post.author?.avatar_url ? <Avatar src={post.author.avatar_url} name={authorName} size={44} /> : <Logo variant="mark" size={44} />}
          <div>
            <p className={styles.author}>{authorName}</p>
            <time className={styles.date} dateTime={post.published_at}>
              {formatLongDate(post.published_at)}
            </time>
          </div>
        </header>

        {post.media.length > 0 && (
          <div className={styles.media}>
            <PostMediaCarousel media={post.media} title={post.title} priority sizes="(min-width: 768px) 720px, 100vw" />
          </div>
        )}

        <div className={styles.body}>
          <PostActions
            post={post}
            onUpdate={updatePost}
            onCommentClick={() => document.getElementById('comentarios')?.scrollIntoView({ behavior: 'smooth' })}
          />
          <h1 id="post-title" className={styles.title}>
            {post.title}
          </h1>
          {postCategories.length > 0 && (
            <ul className={styles.categories} role="list" aria-label="Categorias">
              {postCategories.map((c) => (
                <li key={c.id}>
                  <Button to={`${ROUTES.HOME}?categoria=${c.slug}`} variant="secondary" size="sm">
                    {c.name}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {post.content && <p className={styles.content}>{post.content}</p>}
        </div>
      </article>

      <section id="comentarios" className={styles.comments} aria-labelledby="comments-title">
        <h2 id="comments-title" className={styles.commentsTitle}>
          Comentários {post.comment_count > 0 && <span>({post.comment_count})</span>}
        </h2>
        <CommentList kind="post" targetId={post.id} onCountChange={(count) => updatePost({ comment_count: count })} />
      </section>
    </div>
  )
}
