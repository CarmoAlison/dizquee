import { Button } from '../Button/Button'
import styles from './Pagination.module.css'

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  return (
    <nav className={styles.pagination} aria-label="Paginação">
      <Button variant="secondary" size="sm" icon="chevronLeft" onClick={() => onChange(page - 1)} disabled={page <= 0}>
        Anterior
      </Button>
      <span className={styles.info} aria-live="polite">
        Página {page + 1} de {pages}
      </span>
      <Button variant="secondary" size="sm" iconRight="chevronRight" onClick={() => onChange(page + 1)} disabled={page >= pages - 1}>
        Próxima
      </Button>
    </nav>
  )
}
