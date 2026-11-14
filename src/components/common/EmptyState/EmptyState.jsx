import { cn } from '../../../utils/cn'
import { Icon } from '../Icon/Icon'
import styles from './EmptyState.module.css'

/** Estado vazio ou de erro, com ação opcional. tone: 'neutral' | 'error' */
export function EmptyState({ icon = 'stories', title, description, action, tone = 'neutral', compact = false, className }) {
  return (
    <div className={cn(styles.empty, compact && styles.compact, tone === 'error' && styles.error, className)} role={tone === 'error' ? 'alert' : undefined}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name={tone === 'error' ? 'alert' : icon} size={compact ? 26 : 34} />
      </span>
      {title && <h2 className={styles.title}>{title}</h2>}
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
