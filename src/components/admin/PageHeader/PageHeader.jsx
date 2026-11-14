import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import styles from './PageHeader.module.css'

export function PageHeader({ title, description, actions }) {
  useDocumentTitle(`${title} · Painel`, { noindex: true })
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
