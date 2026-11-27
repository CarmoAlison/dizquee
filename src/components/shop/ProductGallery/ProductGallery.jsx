// Fotos do produto: deslizar (scroll-snap), miniaturas e teclado (← →)
import { useCallback, useRef, useState } from 'react'
import { productImageUrl } from '../../../services/shopService'
import { cn } from '../../../utils/cn'
import { Icon } from '../../common/Icon/Icon'
import styles from './ProductGallery.module.css'

export function ProductGallery({ images = [], name = '' }) {
  const trackRef = useRef(null)
  const [index, setIndex] = useState(0)

  const onScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    setIndex(Math.round(track.scrollLeft / track.clientWidth))
  }, [])

  const goTo = (i) => {
    const track = trackRef.current
    if (!track) return
    const target = Math.max(0, Math.min(images.length - 1, i))
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' })
  }

  if (!images.length) {
    return (
      <div className={cn(styles.gallery, styles.empty)} aria-hidden="true">
        <Icon name="bag" size={56} />
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.gallery}
        role="group"
        aria-roledescription="carrossel"
        aria-label={`Fotos de ${name}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') goTo(index + 1)
          if (e.key === 'ArrowLeft') goTo(index - 1)
        }}
      >
        <div ref={trackRef} className={styles.track} onScroll={onScroll} tabIndex={images.length > 1 ? 0 : -1}>
          {images.map((img, i) => (
            <div key={img.id || img.storage_path} className={styles.slide} aria-label={`Foto ${i + 1} de ${images.length}`}>
              <img
                src={productImageUrl(img.storage_path, { width: 1080 })}
                alt={i === 0 ? name : ''}
                className={styles.image}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                draggable="false"
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button type="button" className={cn(styles.arrow, styles.prev)} onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Foto anterior">
              <Icon name="chevronLeft" />
            </button>
            <button
              type="button"
              className={cn(styles.arrow, styles.next)}
              onClick={() => goTo(index + 1)}
              disabled={index === images.length - 1}
              aria-label="Próxima foto"
            >
              <Icon name="chevronRight" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className={styles.thumbs}>
          {images.map((img, i) => (
            <button
              key={img.id || img.storage_path}
              type="button"
              className={cn(styles.thumb, i === index && styles.thumbActive)}
              onClick={() => goTo(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === index || undefined}
            >
              <img src={productImageUrl(img.storage_path, { width: 160 })} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
