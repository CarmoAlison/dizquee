import { useContext } from 'react'
import { BrandContext } from '../contexts/contexts'

/** { name, shortName, tagline, logoUrl, logoPath, colors, refresh, setSettings } */
export function useBrand() {
  const value = useContext(BrandContext)
  if (!value) throw new Error('useBrand precisa estar dentro do BrandProvider.')
  return value
}
