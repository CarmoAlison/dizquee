// Grupo de opções exclusivas (filtros de status etc.)
import { cn } from '../../../utils/cn'
import styles from './SegmentedControl.module.css'

export function SegmentedControl({ options, value, onChange, label, className }) {
  return (
    <div className={cn(styles.group, className)} role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={cn(styles.option, value === opt.value && styles.active)}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
