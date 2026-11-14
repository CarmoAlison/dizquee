// Modal "entre para interagir": abre sobre a página atual, sem perder o contexto
import { useCallback, useContext, useMemo, useState } from 'react'
import { LoginPromptModal } from '../components/auth/LoginPromptModal/LoginPromptModal'
import { AuthContext, LoginPromptContext } from './contexts'

export function LoginPromptProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext)
  const [reason, setReason] = useState(null)

  const open = useCallback((message) => setReason(message || 'Entre para interagir com o bloco.'), [])
  const close = useCallback(() => setReason(null), [])

  const value = useMemo(() => ({ open, close }), [open, close])

  return (
    <LoginPromptContext.Provider value={value}>
      {children}
      {/* fecha sozinho quando a pessoa entra */}
      <LoginPromptModal open={Boolean(reason) && !isAuthenticated} reason={reason} onClose={close} />
    </LoginPromptContext.Provider>
  )
}
