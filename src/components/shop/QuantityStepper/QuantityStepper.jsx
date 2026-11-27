// Quantidade com botões − / + (áreas de toque de 44 px)
import { Icon } from '../../common/Icon/Icon'
import styles from './QuantityStepper.module.css'

export function QuantityStepper({ value, onChange, min = 1, max = 20, label = 'Quantidade', size = 'md' }) {
  return (
    <div className={styles.stepper} data-size={size} role="group" aria-label={label}>
      <button type="button" className={styles.button} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Diminuir">
        <Icon name="minus" size={18} />
      </button>
      <output className={styles.value} aria-live="polite">
        {value}
      </output>
      <button type="button" className={styles.button} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Aumentar">
        <Icon name="plus" size={18} />
      </button>
    </div>
  )
}
