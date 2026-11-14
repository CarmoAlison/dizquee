// Antes de curtir/comentar/reagir: visitante vê o modal de login,
// banido recebe aviso. Retorna true quando a ação pode seguir.
import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { useLoginPrompt } from './useLoginPrompt'
import { useToast } from './useToast'

export function useInteractionGuard() {
  const { isAuthenticated, isBanned, needsProfileCompletion } = useAuth()
  const loginPrompt = useLoginPrompt()
  const toast = useToast()

  return useCallback(
    (reason) => {
      if (!isAuthenticated) {
        loginPrompt.open(reason)
        return false
      }
      if (isBanned) {
        toast.error('Sua conta está suspensa e não pode interagir.')
        return false
      }
      if (needsProfileCompletion) {
        toast.info('Complete seu cadastro para interagir.')
        return false
      }
      return true
    },
    [isAuthenticated, isBanned, needsProfileCompletion, loginPrompt, toast],
  )
}
