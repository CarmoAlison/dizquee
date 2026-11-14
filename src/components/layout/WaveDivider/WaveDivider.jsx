// Divisor em onda entre seções. color: qualquer valor CSS (ex.: var(--color-bg))
import { cn } from '../../../utils/cn'
import styles from './WaveDivider.module.css'

export function WaveDivider({ color = 'var(--color-bg)', flip = false, height = 36, className }) {
  return (
    <div className={cn(styles.wave, flip && styles.flip, className)} style={{ height }} aria-hidden="true">
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" width="100%" height="100%">
        <path
          fill={color}
          d="M0,48 C180,80 360,80 540,56 C720,32 900,0 1080,16 C1260,32 1350,56 1440,60 L1440,84 L0,84 Z"
        />
      </svg>
    </div>
  )
}
