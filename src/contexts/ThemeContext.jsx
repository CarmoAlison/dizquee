// Tema claro/escuro: respeita prefers-color-scheme até a pessoa escolher
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './contexts'

const STORAGE_KEY = 'theme'

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light',
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#12001A' : '#660385')
  }, [theme])

  // Acompanha o sistema enquanto não houver escolha manual
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => {
      if (!readSaved()) setThemeState(e.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((next) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignora */
    }
  }, [])

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
