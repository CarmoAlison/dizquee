import { cn } from '../../../utils/cn'
import styles from './ProgressBar.module.css'

export function ProgressBar({ value = 0, label = 'Progresso do envio', tone = 'default', className }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className={cn(styles.track, tone === 'error' && styles.error, className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
    >
      <span className={styles.bar} style={{ width: `${v}%` }} />
    </div>
  )
}
