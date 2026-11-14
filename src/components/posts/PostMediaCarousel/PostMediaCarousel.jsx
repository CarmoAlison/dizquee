// Carrossel de fotos/vídeos do post: deslizar (scroll-snap), setas no
// desktop, teclado (← →), indicadores e proporção fixa (sem salto de layout).
import { useCallback, useEffect, useRef, useState } from 'react'
import { BUCKETS, getPublicUrl, getSrcSet } from '../../../services/storageService'
import { cn } from '../../../utils/cn'
import { Icon } from '../../common/Icon/Icon'
import styles from './PostMediaCarousel.module.css'

const MIN_RATIO = 4 / 5
const MAX_RATIO = 1.91

function ratioOf(media) {
  const first = media[0]
  if (!first?.width || !first?.height) return 1
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, first.width / first.height))
}

export function PostMediaCarousel({ media = [], title = '', priority = false, sizes = '(min-width: 1024px) 620px, 100vw' }) {
  const trackRef = useRef(null)
  const [index, setIndex] = useState(0)
  const total = media.length

  const onScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const i = Math.round(track.scrollLeft / track.clientWidth)
    setIndex((prev) => (prev === i ? prev : i))
  }, [])

  // Pausa vídeos que saíram de vista
  useEffect(() => {
    trackRef.current?.querySelectorAll('video').forEach((v, i) => {
      if (i !== index && !v.paused) v.pause()
    })
  }, [index])

  const goTo = (i) => {
    const track = trackRef.current
    if (!track) return
    const target = Math.max(0, Math.min(total - 1, i))
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' })
  }

  if (!total) return null

  return (
    <div
      className={styles.carousel}
      style={{ aspectRatio: ratioOf(media) }}
      role="group"
      aria-roledescription="carrossel"
      aria-label={`Mídias do post ${title}`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') goTo(index + 1)
        if (e.key === 'ArrowLeft') goTo(index - 1)
      }}
    >
      <div ref={trackRef} className={styles.track} onScroll={onScroll} tabIndex={total > 1 ? 0 : -1}>
        {media.map((m, i) => (
          <div
            key={m.id || m.storage_path}
            className={styles.slide}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${total}`}
            aria-hidden={i !== index ? 'true' : undefined}
          >
            {m.type === 'video' ? (
              <video
                className={styles.video}
                src={getPublicUrl(BUCKETS.POST_MEDIA, m.storage_path)}
                controls
                playsInline
                preload={priority && i === 0 ? 'metadata' : 'none'}
                aria-label={`Vídeo ${i + 1} do post ${title}`}
                tabIndex={i === index ? 0 : -1}
              />
            ) : (
              <img
                className={styles.image}
                src={getPublicUrl(BUCKETS.POST_MEDIA, m.storage_path)}
                srcSet={getSrcSet(BUCKETS.POST_MEDIA, m.storage_path)}
                sizes={sizes}
                alt={total > 1 ? `${title} - foto ${i + 1} de ${total}` : title}
                loading={priority && i === 0 ? 'eager' : 'lazy'}
                fetchPriority={priority && i === 0 ? 'high' : undefined}
                decoding="async"
                width={m.width || undefined}
                height={m.height || undefined}
                draggable={false}
              />
            )}
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            className={cn(styles.arrow, styles.prev)}
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label="Mídia anterior"
          >
            <Icon name="chevronLeft" />
          </button>
          <button
            type="button"
            className={cn(styles.arrow, styles.next)}
            onClick={() => goTo(index + 1)}
            disabled={index === total - 1}
            aria-label="Próxima mídia"
          >
            <Icon name="chevronRight" />
          </button>
          <span className={styles.counter} aria-hidden="true">
            {index + 1}/{total}
          </span>
          <div className={styles.dots} aria-hidden="true">
            {media.map((m, i) => (
              <span key={m.id || i} className={cn(styles.dot, i === index && styles.dotActive)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
