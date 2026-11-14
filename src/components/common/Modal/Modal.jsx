// Modal acessível: role="dialog", foco preso, Esc fecha, clique fora fecha,
// no celular vira "folha" que sobe de baixo.
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import { cn } from '../../../utils/cn'
import { Icon } from '../Icon/Icon'
import styles from './Modal.module.css'

export function Modal({ open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true, className }) {
  const titleId = useId()
  const descId = useId()
  const containerRef = useFocusTrap(open)

  useEffect(() => {
    if (!open) return undefined
    // Captura: o modal trata o Esc antes de camadas abaixo (ex.: visualizador de story)
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        onClose?.()
      }
    }
    document.addEventListener('keydown', onKey, true)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.classList.remove('no-scroll')
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        ref={containerRef}
        className={cn(styles.dialog, styles[size], className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <header className={styles.header}>
          {title && (
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
          )}
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </header>
        {description && (
          <p id={descId} className={styles.description}>
            {description}
          </p>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
