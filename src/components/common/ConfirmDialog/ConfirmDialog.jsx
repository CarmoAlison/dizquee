// Confirmação de ações destrutivas
import { useState } from 'react'
import { getErrorMessage } from '../../../utils/errors'
import { Button } from '../Button/Button'
import { Modal } from '../Modal/Modal'
import styles from './ConfirmDialog.module.css'

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Tem certeza?',
  description,
  confirmLabel = 'Confirmar',
  danger = true,
  children,
  confirmDisabled = false,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setLoading(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={handleConfirm} loading={loading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className={styles.text}>{description}</p>}
      {children}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Modal>
  )
}
