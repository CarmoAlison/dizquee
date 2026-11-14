import styles from './AuthDivider.module.css'

export function AuthDivider({ children = 'ou' }) {
  return (
    <div className={styles.divider} role="separator">
      <span>{children}</span>
    </div>
  )
}
