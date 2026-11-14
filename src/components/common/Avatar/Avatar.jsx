import { useState } from 'react'
import { cn } from '../../../utils/cn'
import styles from './Avatar.module.css'

function initials(name) {
  return (
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?'
  )
}

/** size em px; ring: anel degradê (stories) */
export function Avatar({ src, name, size = 40, ring = false, seen = false, className }) {
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed
  return (
    <span
      className={cn(styles.avatar, ring && styles.ring, ring && seen && styles.seen, className)}
      style={{ '--avatar-size': `${size}px` }}
    >
      {showImage ? (
        <img
          src={src}
          alt={name ? `Foto de ${name}` : ''}
          className={styles.image}
          loading="lazy"
          decoding="async"
          width={size}
          height={size}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className={styles.fallback} aria-hidden={name ? undefined : 'true'} role={name ? 'img' : undefined} aria-label={name || undefined}>
          {initials(name)}
        </span>
      )}
    </span>
  )
}
