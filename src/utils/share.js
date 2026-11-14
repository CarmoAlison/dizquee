// Links de compartilhamento
export function getSiteUrl() {
  const env = import.meta.env.VITE_SITE_URL
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return (env || '').replace(/\/$/, '')
}

export function canUseWebShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export function whatsappShareUrl(text, url) {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`
}

export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Alternativa para navegadores antigos
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  document.body.removeChild(area)
}
