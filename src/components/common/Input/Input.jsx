import { useId } from 'react'
import { cn } from '../../../utils/cn'
import styles from './Input.module.css'

/**
 * Campo de formulário acessível: label, dica, erro e status (ok/verificando).
 * as: 'input' | 'textarea' | 'select'
 */
export function Input({
  label,
  hint,
  error,
  success,
  as = 'input',
  className,
  prefix,
  suffix,
  children,
  id: idProp,
  hideLabel = false,
  ...rest
}) {
  const autoId = useId()
  const id = idProp || autoId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const successId = success && !error ? `${id}-ok` : undefined
  const Field = as

  return (
    <div className={cn(styles.field, className)}>
      {label && (
        <label htmlFor={id} className={cn(styles.label, hideLabel && 'visually-hidden')}>
          {label}
          {rest.required && <span className={styles.required} aria-hidden="true"> *</span>}
        </label>
      )}
      <div className={cn(styles.control, error && styles.hasError, success && !error && styles.hasSuccess)}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        <Field
          id={id}
          className={cn(styles.input, as === 'textarea' && styles.textarea, as === 'select' && styles.select)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[hintId, errorId, successId].filter(Boolean).join(' ') || undefined}
          {...rest}
        >
          {children}
        </Field>
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {success && !error && (
        <p id={successId} className={styles.success}>
          {success}
        </p>
      )}
    </div>
  )
}
