import { createPortal } from 'react-dom'
import { cn } from '../../../utils/cn'
import { Icon } from '../Icon/Icon'
import styles from './Toast.module.css'

const ICONS = { success: 'check', error: 'alert', info: 'bell' }

export function ToastViewport({ toasts, onDismiss }) {
  return createPortal(
    <div className={styles.viewport} aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div key={t.id} className={cn(styles.toast, styles[t.type])} role={t.type === 'error' ? 'alert' : 'status'}>
          <Icon name={ICONS[t.type] || 'bell'} size={20} />
          <p className={styles.message}>{t.message}</p>
          <button type="button" className={styles.close} onClick={() => onDismiss(t.id)} aria-label="Fechar aviso">
            <Icon name="close" size={18} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
