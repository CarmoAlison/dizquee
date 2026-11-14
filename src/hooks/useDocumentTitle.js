// Título dinâmico por página (atalho para useSeo).
// Ex.: useDocumentTitle('Entrar', { noindex: true })
import { useSeo } from './useSeo'

export function useDocumentTitle(title, options = {}) {
  useSeo({ title, ...options })
}
