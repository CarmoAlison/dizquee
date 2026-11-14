// Só aceita redirecionamentos internos (evita open redirect: ?redirect=//site-malicioso)
export function safeRedirect(value, fallback = '/') {
  if (!value || typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}
