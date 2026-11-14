import { useContext } from 'react'
import { LoginPromptContext } from '../contexts/contexts'

export function useLoginPrompt() {
  const value = useContext(LoginPromptContext)
  if (!value) throw new Error('useLoginPrompt precisa estar dentro do provider correspondente.')
  return value
}
