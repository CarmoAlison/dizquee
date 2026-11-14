// Visualizador de stories em tela cheia (celular) ou 9:16 centralizado (desktop).
// - barra de progresso segmentada
// - toque à esquerda volta, à direita avança; segurar pausa; deslizar para baixo fecha
// - setas ←/→, Esc e espaço no teclado; vídeo avança ao terminar
// - curtir, comentar (com respostas) e reações rápidas (exigem login)
// - registra a visualização (logado ou sessão anônima) e marca como visto
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBrand } from '../../../hooks/useBrand'
import { createPortal } from 'react-dom'
import { MEDIA_LIMITS } from '../../../constants/mediaLimits'
import { PERMISSIONS } from '../../../constants/permissions'
import { useAuth } from '../../../hooks/useAuth'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import { useInteractionGuard } from '../../../hooks/useInteractionGuard'
import { useLike } from '../../../hooks/useLike'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { BUCKETS, getPublicUrl } from '../../../services/storageService'
import {
  addReaction,
  getMyStoryInteraction,
  getReactionCounts,
  likeStory,
  registerStoryView,
  removeReaction,
  subscribeStoryCounters,
  unlikeStory,
} from '../../../services/storiesService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { formatCount, formatRelative } from '../../../utils/formatDate'
import { Icon } from '../../common/Icon/Icon'
import { Loader } from '../../common/Loader/Loader'
import { CommentList } from '../../comments/CommentList/CommentList'
import { SignupInvite } from '../../layout/SignupInvite/SignupInvite'
import { LikeButton } from '../../posts/LikeButton/LikeButton'
import { ReactionPicker } from '../ReactionPicker/ReactionPicker'
import { StoryProgress } from '../StoryProgress/StoryProgress'
import { StoryStatsModal } from '../StoryStatsModal/StoryStatsModal'
import styles from './StoryViewer.module.css'

const HOLD_DELAY = 180
const TAP_MAX_MS = 300
const SWIPE_CLOSE_PX = 110

export function StoryViewer({ groups, startGroup = 0, startStory = 0, onClose, onSeen }) {
  const { user, isAuthenticated } = useAuth()
  const brand = useBrand()
  const canViewStats = usePermission(PERMISSIONS.STORIES_VIEW_STATS)
  const guard = useInteractionGuard()
  const toast = useToast()

  const [g, setG] = useState(startGroup)
  const [s, setS] = useState(startStory)
  const [held, setHeld] = useState(false)
  const [manualPause, setManualPause] = useState(false)
  const [readyId, setReadyId] = useState(null)
  const [buffering, setBuffering] = useState(false)
  const [videoMeta, setVideoMeta] = useState({ id: null, duration: 0 })
  const [muted, setMuted] = useState(false)
  const [panel, setPanel] = useState(null) // 'comments' | 'stats' | null
  const [ended, setEnded] = useState(false)
  const [overrides, setOverrides] = useState({}) // dados atualizados por story (curtida, reações, contadores)
  const [dragY, setDragY] = useState(0)

  const videoRef = useRef(null)
  const pointerRef = useRef(null)
  const holdTimerRef = useRef(null)
  const heldRef = useRef(false)
  const containerRef = useFocusTrap(true)

  const group = groups[g]
  const baseStory = group?.stories[s]
  const story = baseStory ? { ...baseStory, ...overrides[baseStory.id] } : null
  const storyId = story?.id
  const isVideo = story?.media_type === 'video'
  const mediaReady = readyId === storyId
  const paused = held || manualPause || panel !== null || ended
  const running = !paused && mediaReady && !buffering
  const duration = isVideo
    ? (videoMeta.id === storyId ? videoMeta.duration : story?.duration || 0) * 1000
    : MEDIA_LIMITS.storyImageDuration

  const patchStory = useCallback(
    (id, patch) => setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    [],
  )

  // ------------------------------------------------------------------
  // Navegação
  // ------------------------------------------------------------------
  const next = useCallback(() => {
    const current = groups[g]
    if (!current) return
    if (s < current.stories.length - 1) setS(s + 1)
    else if (g < groups.length - 1) {
      setG(g + 1)
      setS(0)
    } else if (!isAuthenticated) setEnded(true)
    else onClose()
  }, [g, s, groups, isAuthenticated, onClose])

  // (função simples: mexe no elemento de vídeo, então não é memorizada)
  const prev = () => {
    if (s > 0) setS(s - 1)
    else if (g > 0) {
      setG(g - 1)
      setS(groups[g - 1].stories.length - 1)
    } else {
      // primeiro story: reinicia
      setReadyId(null)
      if (videoRef.current) videoRef.current.currentTime = 0
      requestAnimationFrame(() => setReadyId(storyId))
    }
  }

  // ------------------------------------------------------------------
  // Visualização + dados de interação do story atual
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!storyId) return undefined
    onSeen?.(storyId)
    registerStoryView(storyId).catch(() => {})
    let cancelled = false
    Promise.all([getMyStoryInteraction(user?.id, storyId), getReactionCounts(storyId)])
      .then(([mine, counts]) => {
        if (!cancelled) patchStory(storyId, { liked: mine.liked, reactions: mine.reactions, counts })
      })
      .catch(() => {})
    const unsubscribe = subscribeStoryCounters(storyId, (row) =>
      patchStory(storyId, { like_count: row.like_count, comment_count: row.comment_count, view_count: row.view_count }),
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [storyId, user?.id, onSeen, patchStory])

  // Pré-carrega a próxima imagem
  useEffect(() => {
    const upcoming = group?.stories[s + 1] || groups[g + 1]?.stories[0]
    if (upcoming?.media_type === 'image') {
      const img = new Image()
      img.src = getPublicUrl(BUCKETS.STORY_MEDIA, upcoming.storage_path)
    }
  }, [g, s, group, groups])

  // Play/pause do vídeo acompanhando o estado
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isVideo || !mediaReady) return
    if (paused) {
      video.pause()
      return
    }
    video.play().catch(() => {
      // navegador bloqueou som automático: tenta sem som
      video.muted = true
      setMuted(true)
      video.play().catch(() => {})
    })
  }, [paused, isVideo, mediaReady, storyId])

  // Teclado e trava de rolagem. Os handlers ficam num ref para o listener
  // ser registrado uma única vez e sempre usar a versão atual.
  const keyHandlersRef = useRef(null)
  useEffect(() => {
    keyHandlersRef.current = { next, prev, onClose, panel }
  })
  useEffect(() => {
    const onKey = (e) => {
      const { next, prev, onClose, panel } = keyHandlersRef.current || {}
      if (!next) return
      if (e.defaultPrevented) return
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      if (e.key === 'Escape') {
        e.preventDefault()
        if (panel) setPanel(null)
        else onClose()
        return
      }
      if (typing || panel) return
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === ' ') {
        e.preventDefault()
        setManualPause((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [])

  useEffect(() => () => clearTimeout(holdTimerRef.current), [])

  // ------------------------------------------------------------------
  // Gestos (toque, segurar, deslizar para baixo)
  // ------------------------------------------------------------------
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointerRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false }
    clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => {
      heldRef.current = true
      setHeld(true)
    }, HOLD_DELAY)
  }

  const onPointerMove = (e) => {
    const p = pointerRef.current
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) p.moved = true
    if (dy > 0 && Math.abs(dy) > Math.abs(dx)) setDragY(dy)
  }

  const endPointer = (e, cancelled = false) => {
    clearTimeout(holdTimerRef.current)
    const p = pointerRef.current
    pointerRef.current = null
    const wasHeld = heldRef.current
    heldRef.current = false
    setHeld(false)
    setDragY(0)
    if (!p || cancelled) return
    const dy = e.clientY - p.y
    if (dy > SWIPE_CLOSE_PX) {
      onClose()
      return
    }
    if (wasHeld || p.moved || Date.now() - p.t > TAP_MAX_MS) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (e.clientX - rect.left < rect.width * 0.3) prev()
    else next()
  }

  // ------------------------------------------------------------------
  // Interações
  // ------------------------------------------------------------------
  const like = () => likeStory(storyId, user.id)
  const unlike = () => unlikeStory(storyId, user.id)
  const update = (patch) => patchStory(storyId, patch)
  const toggleLike = useLike({ item: story, update, like, unlike, reason: 'Entre para curtir este story.' })

  const requireLogin = (reason) => {
    if (guard(reason)) return true
    setManualPause(true)
    return false
  }

  const handleLike = () => {
    if (!requireLogin('Entre para curtir este story.')) return
    toggleLike()
  }

  const toggleReaction = async (emoji) => {
    if (!requireLogin('Entre para reagir a este story.')) return
    const id = storyId
    const current = overrides[id] || {}
    const mine = current.reactions || []
    const counts = current.counts || {}
    const has = mine.includes(emoji)
    patchStory(id, {
      reactions: has ? mine.filter((x) => x !== emoji) : [...mine, emoji],
      counts: { ...counts, [emoji]: Math.max(0, (counts[emoji] || 0) + (has ? -1 : 1)) },
    })
    try {
      if (has) await removeReaction(id, user.id, emoji)
      else await addReaction(id, user.id, emoji)
    } catch (e) {
      patchStory(id, { reactions: mine, counts })
      toast.error(getErrorMessage(e, 'Não foi possível reagir.'))
    }
  }

  const openComments = () => setPanel('comments')

  if (!story) return null

  const mediaUrl = getPublicUrl(BUCKETS.STORY_MEDIA, story.storage_path)
  const title = group.isActive ? brand.shortName : group.title

  return createPortal(
    <div className={styles.backdrop} data-story-viewer>
      <div
        ref={containerRef}
        className={styles.viewer}
        role="dialog"
        aria-modal="true"
        aria-label={`Stories: ${title}`}
        style={dragY ? { transform: `translateY(${dragY}px)`, opacity: Math.max(0.4, 1 - dragY / 500) } : undefined}
      >
        <div className={styles.frame}>
          {/* Mídia + áreas de toque */}
          <div
            className={styles.media}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endPointer(e)}
            onPointerCancel={(e) => endPointer(e, true)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {isVideo ? (
              <video
                key={story.id}
                ref={videoRef}
                className={styles.content}
                src={mediaUrl}
                playsInline
                muted={muted}
                preload="auto"
                onLoadedMetadata={(e) => setVideoMeta({ id: story.id, duration: e.currentTarget.duration })}
                onCanPlay={() => setReadyId(story.id)}
                onWaiting={() => setBuffering(true)}
                onPlaying={() => setBuffering(false)}
                onEnded={next}
                onError={() => setReadyId(story.id)}
                aria-label={story.caption || 'Vídeo do story'}
              />
            ) : (
              <img
                key={story.id}
                className={styles.content}
                src={mediaUrl}
                alt={story.caption || `Story de ${title}`}
                onLoad={() => setReadyId(story.id)}
                onError={() => setReadyId(story.id)}
                draggable={false}
              />
            )}
            {!mediaReady && (
              <div className={styles.loading}>
                <Loader />
              </div>
            )}
            {paused && mediaReady && !panel && !ended && (
              <span className={styles.pausedBadge} aria-hidden="true">
                <Icon name="pause" size={18} />
              </span>
            )}
          </div>

          {/* Topo: progresso + cabeçalho */}
          <div className={styles.top}>
            <StoryProgress
              count={group.stories.length}
              current={s}
              duration={duration}
              running={running && (!isVideo || duration > 0)}
              storyKey={`${story.id}-${readyId === story.id}`}
              onComplete={isVideo ? undefined : next}
            />
            <div className={styles.header}>
              <img src={brand.logoUrl} alt="" width={32} height={32} className={styles.headerAvatar} />
              <div className={styles.headerText}>
                <strong>{title}</strong>
                <span>{formatRelative(story.created_at)}</span>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setManualPause((v) => !v)}
                aria-label={manualPause ? 'Continuar' : 'Pausar'}
              >
                <Icon name={manualPause ? 'play' : 'pause'} size={20} />
              </button>
              {isVideo && (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? 'Ativar som' : 'Desativar som'}
                >
                  <Icon name={muted ? 'volumeOff' : 'volume'} size={20} />
                </button>
              )}
              <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Fechar stories" data-autofocus>
                <Icon name="close" size={22} />
              </button>
            </div>
          </div>

          {/* Rodapé: legenda e interações */}
          <div className={styles.bottom}>
            {story.caption && <p className={styles.caption}>{story.caption}</p>}
            <div className={styles.actions}>
              <LikeButton liked={story.liked} count={story.like_count} onToggle={handleLike} variant="overlay" label="story" />
              <button
                type="button"
                className={styles.actionButton}
                onClick={openComments}
                aria-label={`Comentários: ${story.comment_count || 0}`}
              >
                <Icon name="comment" size={22} />
                <span aria-hidden="true">{formatCount(story.comment_count)}</span>
              </button>
              {canViewStats && (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => setPanel('stats')}
                  aria-label={`Visualizações: ${story.view_count || 0}. Ver estatísticas`}
                >
                  <Icon name="eye" size={22} />
                  <span aria-hidden="true">{formatCount(story.view_count)}</span>
                </button>
              )}
            </div>
            <ReactionPicker selected={story.reactions} counts={story.counts} onToggle={toggleReaction} />
            {!isAuthenticated && <p className={styles.hint}>Entre para curtir, comentar e reagir.</p>}
          </div>

          {/* Comentários (folha sobre o story) */}
          {panel === 'comments' && (
            <div className={styles.sheet} role="region" aria-label="Comentários do story">
              <div className={styles.sheetHeader}>
                <h2>Comentários</h2>
                <button type="button" className={styles.iconButton} onClick={() => setPanel(null)} aria-label="Fechar comentários">
                  <Icon name="close" size={20} />
                </button>
              </div>
              <div className={styles.sheetBody}>
                <CommentList
                  kind="story"
                  targetId={story.id}
                  maxLength={500}
                  tone="dark"
                  onCountChange={(count) => patchStory(story.id, { comment_count: count })}
                />
              </div>
            </div>
          )}

          {/* Fim dos stories para visitantes: convite de cadastro */}
          {ended && (
            <div className={styles.endScreen}>
              <SignupInvite variant="card" />
              <button type="button" className={styles.endClose} onClick={onClose}>
                Fechar
              </button>
            </div>
          )}
        </div>

        {/* Setas laterais (desktop) */}
        <button type="button" className={cn(styles.navArrow, styles.navPrev)} onClick={prev} aria-label="Story anterior">
          <Icon name="chevronLeft" size={26} />
        </button>
        <button type="button" className={cn(styles.navArrow, styles.navNext)} onClick={next} aria-label="Próximo story">
          <Icon name="chevronRight" size={26} />
        </button>
      </div>

      <StoryStatsModal storyId={story.id} open={panel === 'stats'} onClose={() => setPanel(null)} />
    </div>,
    document.body,
  )
}
