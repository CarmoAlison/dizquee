import { useContext } from 'react'
import { ThemeContext } from '../contexts/contexts'

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme precisa estar dentro do provider correspondente.')
  return value
}
