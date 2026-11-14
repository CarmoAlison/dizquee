import { cn } from '../../../utils/cn'
import styles from './Skeleton.module.css'

/** Bloco de carregamento. variant: rect | text | circle */
export function Skeleton({ width, height, variant = 'rect', className, style }) {
  return (
    <span
      className={cn(styles.skeleton, styles[variant], className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  )
}
