import { useId } from 'react'
import { cn } from '../../../utils/cn'
import styles from './Checkbox.module.css'

export function Checkbox({ label, description, error, className, id: idProp, ...rest }) {
  const autoId = useId()
  const id = idProp || autoId
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className={cn(styles.wrapper, className)}>
      <label htmlFor={id} className={styles.row}>
        <input
          id={id}
          type="checkbox"
          className={styles.input}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          {...rest}
        />
        <span className={styles.box} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          {description && <span className={styles.description}>{description}</span>}
        </span>
      </label>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
