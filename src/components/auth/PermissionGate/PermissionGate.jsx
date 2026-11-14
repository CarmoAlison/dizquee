// Mostra o conteúdo só para quem tem a permissão (qualquer uma da lista).
// Isto é apenas UX: a RLS no banco é quem realmente protege os dados.
import { usePermission } from '../../../hooks/usePermission'

export function PermissionGate({ permission, children, fallback = null }) {
  const allowed = usePermission(permission)
  return allowed ? children : fallback
}
