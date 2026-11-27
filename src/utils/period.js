// Períodos prontos para filtros (datas "yyyy-MM-dd", fuso local)
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns'

const ymd = (d) => format(d, 'yyyy-MM-dd')

export const PERIOD_PRESETS = {
  month: { label: 'Este mês', range: (now) => [startOfMonth(now), endOfMonth(now)] },
  lastMonth: { label: 'Mês passado', range: (now) => [startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1))] },
  last30: { label: 'Últimos 30 dias', range: (now) => [subDays(now, 29), now] },
  year: { label: 'Este ano', range: (now) => [startOfYear(now), endOfYear(now)] },
}

export function presetRange(key, now = new Date()) {
  const [from, to] = PERIOD_PRESETS[key].range(now)
  return { from: ymd(from), to: ymd(to) }
}

// Agrupamento sugerido para o gráfico conforme o tamanho do período
export function suggestedGroup(from, to) {
  const days = (new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000
  if (days > 120) return 'month'
  if (days > 45) return 'week'
  return 'day'
}
