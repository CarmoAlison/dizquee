// Página de stories (aba "Stories" da barra inferior): stories de agora e destaques.
// Aceita ?story=<id> para abrir direto um story (links de notificação).
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useStories } from '../../../hooks/useStories'
import { highlightCoverUrl } from '../../../services/highlightsService'
import { BUCKETS, getPublicUrl } from '../../../services/storageService'
import { cn } from '../../../utils/cn'
import { formatRelative } from '../../../utils/formatDate'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Icon } from '../../../components/common/Icon/Icon'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { SignupInvite } from '../../../components/layout/SignupInvite/SignupInvite'
import { StoryViewer } from '../../../components/stories/StoryViewer/StoryViewer'
import styles from './Stories.module.css'

export default function Stories() {
  useDocumentTitle('Stories', {
    description: 'Stories e destaques do bloco: os bastidores, ensaios e desfiles em fotos e vídeos curtos.',
  })
  const { groups, active, seen, loading, error, reload, markSeen } = useStories()
  const [params, setParams] = useSearchParams()
  const [viewer, setViewer] = useState(null) // { group, story }
  const [notFound, setNotFound] = useState(false)
  const target = params.get('story')

  // Abre o story indicado na URL
  useEffect(() => {
    if (!target || loading) return
    const gi = groups.findIndex((g) => g.stories.some((s) => s.id === target))
    if (gi >= 0) {
      setViewer({ group: gi, story: groups[gi].stories.findIndex((s) => s.id === target) })
      setNotFound(false)
    } else {
      setNotFound(true)
    }
    const next = new URLSearchParams(params)
    next.delete('story')
    setParams(next, { replace: true })
  }, [target, loading, groups, params, setParams])

  const activeGroupIndex = groups.findIndex((g) => g.isActive)

  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>Stories</h1>

      {notFound && <p className={styles.notice}>Este story não está mais disponível (expirou ou foi removido).</p>}

      {loading && (
        <div className={styles.grid} aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={0} style={{ aspectRatio: '9 / 16', borderRadius: 18 }} />
          ))}
        </div>
      )}

      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && groups.length === 0 && (
        <EmptyState icon="stories" title="Nenhum story agora" description="Volte mais tarde: o bloco sempre tem novidades!" />
      )}

      {!loading && active.length > 0 && (
        <section className={styles.section} aria-labelledby="stories-now">
          <h2 id="stories-now" className={styles.sectionTitle}>
            Agora <span>· somem em 24 h</span>
          </h2>
          <ul className={styles.grid} role="list">
            {active.map((story, i) => (
              <li key={story.id}>
                <StoryTile
                  story={story}
                  seen={seen.has(story.id)}
                  onOpen={() => setViewer({ group: activeGroupIndex, story: i })}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && groups.some((g) => !g.isActive) && (
        <section className={styles.section} aria-labelledby="stories-highlights">
          <h2 id="stories-highlights" className={styles.sectionTitle}>
            Destaques
          </h2>
          <ul className={styles.highlights} role="list">
            {groups.map((g, gi) =>
              g.isActive ? null : (
                <li key={g.id}>
                  <button
                    type="button"
                    className={styles.highlight}
                    onClick={() => setViewer({ group: gi, story: 0 })}
                    aria-label={`Abrir destaque ${g.title} (${g.stories.length} stories)`}
                  >
                    <span className={cn(styles.highlightRing, g.allSeen && styles.seen)}>
                      {highlightCoverUrl(g.highlight, g.stories[0]) ? (
                        <img src={highlightCoverUrl(g.highlight, g.stories[0])} alt="" loading="lazy" />
                      ) : (
                        <span className={styles.highlightFallback}>
                          <Icon name="star" />
                        </span>
                      )}
                    </span>
                    <span className={styles.highlightTitle}>{g.title}</span>
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      <SignupInvite variant="card" className={styles.invite} />

      {viewer && groups[viewer.group] && (
        <StoryViewer
          groups={groups}
          startGroup={viewer.group}
          startStory={Math.max(0, viewer.story)}
          onClose={() => setViewer(null)}
          onSeen={markSeen}
        />
      )}
    </div>
  )
}

function StoryTile({ story, seen, onOpen }) {
  const url = getPublicUrl(BUCKETS.STORY_MEDIA, story.storage_path)
  return (
    <button type="button" className={cn(styles.tile, seen && styles.tileSeen)} onClick={onOpen} aria-label={`Abrir story${story.caption ? `: ${story.caption}` : ''}`}>
      {story.media_type === 'video' ? (
        <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className={styles.tileMedia} aria-hidden="true" tabIndex={-1} />
      ) : (
        <img src={url} alt="" loading="lazy" className={styles.tileMedia} />
      )}
      <span className={styles.tileInfo}>
        {story.media_type === 'video' && <Icon name="play" size={16} />}
        {formatRelative(story.created_at)}
      </span>
    </button>
  )
}
