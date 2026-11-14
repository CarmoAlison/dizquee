import { Icon } from '../../common/Icon/Icon'
import styles from './StatCard.module.css'

export function StatCard({ label, value, hint, icon }) {
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <strong className={styles.value}>{value}</strong>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
