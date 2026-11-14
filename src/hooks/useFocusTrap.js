// Prende o foco dentro de um container (modais/visualizador) e devolve
// o foco ao elemento anterior ao fechar.
import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(active) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const container = containerRef.current
    const previous = document.activeElement

    const focusFirst = () => {
      const first = container?.querySelector('[data-autofocus]') || container?.querySelector(FOCUSABLE)
      ;(first || container)?.focus()
    }
    const id = requestAnimationFrame(focusFirst)

    const onKeyDown = (e) => {
      if (e.key !== 'Tab' || !container) return
      const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('keydown', onKeyDown)
      if (previous && typeof previous.focus === 'function') previous.focus()
    }
  }, [active])

  return containerRef
}
