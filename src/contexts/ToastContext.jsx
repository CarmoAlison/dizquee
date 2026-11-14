// Toasts de feedback (sucesso, erro, informação)
import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastViewport } from '../components/common/Toast/Toast'
import { ToastContext } from './contexts'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (message, { type = 'info', duration = 4000 } = {}) => {
      const id = ++idRef.current
      setToasts((list) => [...list.slice(-3), { id, message, type }])
      if (duration) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      show,
      dismiss,
      success: (m, o) => show(m, { ...o, type: 'success' }),
      error: (m, o) => show(m, { duration: 6000, ...o, type: 'error' }),
      info: (m, o) => show(m, { ...o, type: 'info' }),
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}
