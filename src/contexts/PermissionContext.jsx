// Permissões do usuário logado para a interface (somente UX: a
// segurança real está na RLS do banco).
import { useContext, useMemo } from 'react'
import { ADMIN_MODULE_ACCESS } from '../constants/permissions'
import { AuthContext, PermissionContext } from './contexts'

export function PermissionProvider({ children }) {
  const { permissions, isStaff } = useContext(AuthContext)

  const value = useMemo(() => {
    const set = new Set(isStaff ? permissions : [])
    const has = (key) => set.has(key)
    const hasAny = (keys) => (Array.isArray(keys) ? keys : [keys]).some((k) => set.has(k))
    const canAccessModule = (module) => hasAny(ADMIN_MODULE_ACCESS[module] || [])
    const canAccessAdmin = isStaff && Object.keys(ADMIN_MODULE_ACCESS).some(canAccessModule)
    return { permissions: set, has, hasAny, canAccessModule, canAccessAdmin }
  }, [permissions, isStaff])

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}
