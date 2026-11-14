// Filtro por categoria em chips que rolam na horizontal
import { cn } from '../../../utils/cn'
import { Skeleton } from '../../common/Skeleton/Skeleton'
import styles from './CategoryChips.module.css'

export function CategoryChips({ categories, selected, onSelect, loading }) {
  if (loading) {
    return (
      <div className={styles.chips} aria-hidden="true">
        {[70, 90, 80, 110].map((w) => (
          <Skeleton key={w} width={w} height={38} style={{ borderRadius: 999, flexShrink: 0 }} />
        ))}
      </div>
    )
  }
  if (!categories.length) return null
  return (
    <nav className={styles.chips} aria-label="Filtrar por categoria">
      <button
        type="button"
        className={cn(styles.chip, !selected && styles.active)}
        aria-pressed={!selected}
        onClick={() => onSelect(null)}
      >
        Todas
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={cn(styles.chip, selected === c.slug && styles.active)}
          aria-pressed={selected === c.slug}
          onClick={() => onSelect(c.slug)}
        >
          {c.color && <span className={styles.dot} style={{ background: c.color }} aria-hidden="true" />}
          {c.name}
        </button>
      ))}
    </nav>
  )
}
