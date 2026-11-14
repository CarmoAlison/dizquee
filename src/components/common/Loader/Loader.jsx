import { cn } from '../../../utils/cn'
import styles from './Loader.module.css'

export function Loader({ size = 'md', inline = false, label = 'Carregando', fullPage = false }) {
  const spinner = <span className={cn(styles.spinner, styles[size])} aria-hidden="true" />
  if (inline) return spinner
  return (
    <div className={cn(styles.wrapper, fullPage && styles.fullPage)} role="status" aria-live="polite">
      {spinner}
      <span className="visually-hidden">{label}…</span>
    </div>
  )
}
