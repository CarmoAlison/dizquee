// Identidade visual em tempo de execução: carrega nome/slogan/logo/cores do
// banco e aplica as cores como variáveis CSS no <html>. Guarda uma cópia
// local para o site já abrir com a marca certa (sem "piscar").
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getBrandSettings } from '../services/brandService'
import { applyBrandColors, toBrand } from '../utils/brand'
import { BrandContext } from './contexts'

const CACHE_KEY = 'brand_settings'

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
  } catch {
    return null
  }
}

export function BrandProvider({ children }) {
  const [row, setRow] = useState(() => readCache())
  const brand = useMemo(() => toBrand(row), [row])

  const refresh = useCallback(async () => {
    try {
      const data = await getBrandSettings()
      if (data) {
        setRow(data)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data))
        } catch {
          /* ignora */
        }
      }
    } catch {
      /* sem conexão ou tabela ainda não criada: usa o padrão */
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    applyBrandColors(brand.colors)
    const icon = document.querySelector('link[rel="icon"]')
    if (icon && brand.logoPath) icon.setAttribute('href', brand.logoUrl)
  }, [brand])

  const value = useMemo(() => ({ ...brand, refresh, setSettings: setRow }), [brand, refresh])
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}
