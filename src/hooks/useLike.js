// Curtida com atualização otimista (posts e stories).
// item precisa ter { liked, like_count }; update aplica um patch no estado do pai.
import { useCallback, useRef } from 'react'
import { getErrorMessage } from '../utils/errors'
import { useInteractionGuard } from './useInteractionGuard'
import { useToast } from './useToast'

export function useLike({ item, update, like, unlike, reason = 'Entre para curtir.' }) {
  const guard = useInteractionGuard()
  const toast = useToast()
  const pendingRef = useRef(false)

  return useCallback(async () => {
    if (!item || !guard(reason) || pendingRef.current) return
    pendingRef.current = true
    const previous = { liked: item.liked, like_count: item.like_count }
    const next = !item.liked
    update({ liked: next, like_count: Math.max(0, (item.like_count || 0) + (next ? 1 : -1)) })
    try {
      if (next) await like()
      else await unlike()
    } catch (e) {
      update(previous)
      toast.error(getErrorMessage(e, 'Não foi possível registrar a curtida.'))
    } finally {
      pendingRef.current = false
    }
  }, [item, update, like, unlike, reason, guard, toast])
}
