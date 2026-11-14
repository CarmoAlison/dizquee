import { useContext } from 'react'
import { AuthContext } from '../contexts/contexts'

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa estar dentro do provider correspondente.')
  return value
}
