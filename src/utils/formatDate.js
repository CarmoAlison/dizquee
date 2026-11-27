// Datas em português (date-fns: leve, modular e com locale pt-BR)
import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : parseISO(value)
  return isValid(d) ? d : null
}

// "há 5 min", "há 2 dias"
export function formatRelative(value) {
  const d = toDate(value)
  if (!d) return ''
  if (Date.now() - d.getTime() < 45 * 1000) return 'agora'
  return `há ${formatDistanceToNowStrict(d, { locale: ptBR })}`
}

// "13 de novembro de 2026"
export function formatLongDate(value) {
  const d = toDate(value)
  return d ? format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''
}

// "13/11/2026 14:30"
export function formatDateTime(value) {
  const d = toDate(value)
  return d ? format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR }) : ''
}

// "13/11"
export function formatShortDay(value) {
  const d = toDate(value)
  return d ? format(d, 'dd/MM', { locale: ptBR }) : ''
}

// Valor para <input type="datetime-local">
export function toDateTimeLocal(value) {
  const d = toDate(value) || new Date()
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

// Data ISO da entrada <input type="datetime-local">
export function fromDateTimeLocal(value) {
  if (!value) return null
  const d = new Date(value)
  return isValid(d) ? d.toISOString() : null
}

// Números compactos: 1,2 mil
export function formatCount(n) {
  const value = Number(n) || 0
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

// Coluna "date" do banco ("2026-11-26"), sem deslocar pelo fuso: "26 de novembro de 2026"
export function formatDateOnly(value) {
  return value ? formatLongDate(`${value}T12:00:00`) : ''
}

// "2026-11-26" de hoje (fuso local), para <input type="date">
export function todayInput() {
  return format(new Date(), 'yyyy-MM-dd')
}
