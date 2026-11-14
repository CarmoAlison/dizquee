// Barra de progresso segmentada. O segmento atual anima via CSS
// (animation-play-state pausa/retoma sem re-renderizar a cada quadro).
import { cn } from '../../../utils/cn'
import styles from './StoryProgress.module.css'

export function StoryProgress({ count, current, duration, running, storyKey, onComplete }) {
  return (
    <div className={styles.progress} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={styles.segment}>
          {i < current && <span className={cn(styles.fill, styles.done)} />}
          {i === current && (
            <span
              key={storyKey}
              data-motion="essential"
              className={cn(styles.fill, styles.active)}
              style={{
                animationDuration: `${Math.max(500, duration || 5000)}ms`,
                animationPlayState: running ? 'running' : 'paused',
              }}
              onAnimationEnd={onComplete}
            />
          )}
        </span>
      ))}
    </div>
  )
}
