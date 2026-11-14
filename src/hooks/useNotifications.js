import { useContext } from 'react'
import { NotificationsContext } from '../contexts/contexts'

export function useNotifications() {
  const value = useContext(NotificationsContext)
  if (!value) throw new Error('useNotifications precisa estar dentro do provider correspondente.')
  return value
}
