// Valores em reais
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatMoney(value) {
  return BRL.format(Number(value) || 0)
}

// "49,90" | "49.90" | "R$ 49,90" -> 49.9 (null se inválido)
export function parseMoney(text) {
  const raw = String(text ?? '').replace(/[^\d,.-]/g, '')
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const n = Number(normalized)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

// 49.9 -> "49,90" (para campos de formulário)
export function moneyInput(value) {
  if (value === null || value === undefined || value === '') return ''
  return Number(value).toFixed(2).replace('.', ',')
}
