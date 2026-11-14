// Carrega dados de forma assíncrona com loading/erro/recarregar.
// Ignora respostas antigas quando as dependências mudam.
import { useCallback, useEffect, useRef, useState } from 'react'

export function useAsync(fn, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  const requestRef = useRef(0)
  const fnRef = useRef(fn)

  useEffect(() => {
    fnRef.current = fn
  })

  const run = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await fnRef.current()
      if (requestId === requestRef.current) setData(result)
      return result
    } catch (e) {
      if (requestId === requestRef.current) setError(e)
      return null
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) run()
    else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps])

  return { data, setData, loading, error, reload: run }
}
