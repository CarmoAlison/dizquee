// Escolha de variação em "chips" (grupo de rádio acessível).
// Opções sem estoque aparecem riscadas e desabilitadas.
import { useId } from 'react'
import { cn } from '../../../utils/cn'
import styles from './OptionPicker.module.css'

export function OptionPicker({ label, options = [], value, onChange, minStock = 1, error }) {
  const id = useId()
  return (
    <fieldset className={styles.fieldset} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.options}>
        {options.map((opt) => {
          const unavailable = opt.stock < minStock
          return (
            <label key={opt.id} className={cn(styles.option, value === opt.id && styles.selected, unavailable && styles.unavailable)}>
              <input
                type="radio"
                name={id}
                value={opt.id}
                checked={value === opt.id}
                disabled={unavailable}
                onChange={() => onChange(opt.id)}
                className="visually-hidden"
              />
              <span>{opt.name}</span>
              {unavailable && <span className="visually-hidden"> (esgotado)</span>}
            </label>
          )
        })}
      </div>
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
