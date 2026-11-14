import { useContext } from 'react'
import { ToastContext } from '../contexts/contexts'

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast precisa estar dentro do provider correspondente.')
  return value
}
