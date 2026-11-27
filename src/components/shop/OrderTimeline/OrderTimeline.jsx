// Linha do tempo do pedido (histórico de status)
import { ORDER_STATUS } from '../../../constants/orders'
import { cn } from '../../../utils/cn'
import { formatDateTime } from '../../../utils/formatDate'
import { Icon } from '../../common/Icon/Icon'
import styles from './OrderTimeline.module.css'

export function OrderTimeline({ history = [], showActor = false }) {
  if (!history.length) return null
  return (
    <ol className={styles.timeline}>
      {history.map((h, i) => {
        const info = ORDER_STATUS[h.to_status] || { label: h.to_status, icon: 'check', tone: 'neutral' }
        const last = i === history.length - 1
        return (
          <li key={h.id} className={cn(styles.step, last && styles.current, styles[info.tone])}>
            <span className={styles.dot} aria-hidden="true">
              <Icon name={info.icon} size={14} strokeWidth={3} />
            </span>
            <div className={styles.text}>
              <span className={styles.label}>{info.label}</span>
              <span className={styles.meta}>
                {formatDateTime(h.created_at)}
                {showActor && h.actor && ` · ${h.actor.full_name || `@${h.actor.username}`}`}
              </span>
              {h.note && <span className={styles.note}>{h.note}</span>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
