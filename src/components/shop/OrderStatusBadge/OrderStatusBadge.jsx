import { ORDER_STATUS } from '../../../constants/orders'
import { cn } from '../../../utils/cn'
import styles from './OrderStatusBadge.module.css'

export function OrderStatusBadge({ status, className }) {
  const info = ORDER_STATUS[status] || { label: status, tone: 'neutral' }
  return <span className={cn(styles.badge, styles[info.tone], className)}>{info.label}</span>
}
