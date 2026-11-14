import { useContext } from 'react'
import { PermissionContext } from '../contexts/contexts'

/**
 * usePermission('posts.create') -> boolean
 * usePermission(['posts.edit_own', 'posts.edit_any']) -> boolean (qualquer uma)
 * usePermission() -> { has, hasAny, canAccessModule, canAccessAdmin }
 * Só UX: a segurança real é a RLS.
 */
export function usePermission(keys) {
  const ctx = useContext(PermissionContext)
  if (!ctx) throw new Error('usePermission precisa estar dentro do PermissionProvider.')
  if (keys === undefined) return ctx
  return ctx.hasAny(keys)
}
