// Utilitários de cor (contraste WCAG) para a tela de identidade visual

function channel(c) {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map(channel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Razão de contraste entre duas cores (1 a 21). AA texto normal: >= 4.5
export function contrastRatio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

export function isValidHex(hex) {
  return /^#[0-9a-f]{6}$/i.test(String(hex || ''))
}
