// Exportação do financeiro: CSV (abre direto no Excel em português) e
// Excel .xlsx de verdade, com várias abas (biblioteca "write-excel-file",
// carregada só quando a pessoa exporta).
import { ENTRY_SOURCES, ENTRY_TYPES, FINANCE_PAYMENT_METHODS, statusLabel } from '../constants/finance'

const MONEY_FORMAT = '"R$" #,##0.00;[Red]-"R$" #,##0.00'

// "2026-11-26" -> "26/11/2026"
function br(date) {
  if (!date) return ''
  const [y, m, d] = String(date).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function fileSuffix(from, to) {
  return `${from}_a_${to}`
}

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function entryRow(e) {
  return {
    date: e.ref_date,
    type: ENTRY_TYPES[e.type]?.label || e.type,
    category: e.finance_categories?.name || '',
    description: e.description,
    amount: (e.type === 'expense' ? -1 : 1) * Number(e.amount),
    status: statusLabel(e.type, e.status),
    due: e.due_date,
    paid: e.paid_at,
    method: FINANCE_PAYMENT_METHODS[e.payment_method] || '',
    source: ENTRY_SOURCES[e.source] || e.source,
    notes: e.notes || '',
  }
}

// ----- CSV -----
export function exportEntriesCsv(entries, { from, to }) {
  const header = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Situação', 'Vencimento', 'Pagamento', 'Forma', 'Origem', 'Observação']
  const escape = (v) => {
    const s = String(v ?? '')
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [header.join(';')]
  for (const e of entries) {
    const r = entryRow(e)
    lines.push(
      [br(r.date), r.type, r.category, r.description, r.amount.toFixed(2).replace('.', ','), r.status, br(r.due), br(r.paid), r.method, r.source, r.notes]
        .map(escape)
        .join(';'),
    )
  }
  // BOM: o Excel reconhece os acentos (UTF-8)
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `lancamentos_${fileSuffix(from, to)}.csv`)
}

// ----- Excel (.xlsx) -----
const bold = (value, extra = {}) => ({ value, fontWeight: 'bold', ...extra })
const money = (value, extra = {}) => ({ value: Number(value) || 0, type: Number, format: MONEY_FORMAT, ...extra })
const dateCell = (value) => (value ? { value: new Date(`${String(value).slice(0, 10)}T12:00:00`), type: Date, format: 'dd/mm/yyyy' } : null)
const HEAD = { backgroundColor: '#660385', textColor: '#FFFFFF', fontWeight: 'bold' }

export async function exportFinanceXlsx({ brandName, from, to, summary, entries, products }) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const balance = Number(summary.income_paid) - Number(summary.expense_paid)

  const resumo = [
    [bold(`${brandName} · Relatório financeiro`, { fontSize: 14 })],
    [`Período: ${br(from)} a ${br(to)}`],
    [`Gerado em ${new Date().toLocaleString('pt-BR')}`],
    [],
    [bold('Indicador', HEAD), bold('Valor', HEAD)],
    ['Entradas (recebidas)', money(summary.income_paid)],
    ['Saídas (pagas)', money(summary.expense_paid)],
    [bold('Saldo do período'), money(balance, { fontWeight: 'bold' })],
    ['A receber no período', money(summary.income_pending)],
    ['A pagar no período', money(summary.expense_pending)],
    ['Despesas vencidas (total)', money(summary.overdue_expense)],
    [],
    [bold('Categoria', HEAD), bold('Tipo', HEAD), bold('Pago/recebido', HEAD), bold('Pendente', HEAD)],
    ...(summary.by_category || []).map((c) => [c.name, ENTRY_TYPES[c.type]?.label, money(c.paid), money(c.pending)]),
  ]

  const lancamentos = [
    ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Situação', 'Vencimento', 'Pagamento', 'Forma', 'Origem', 'Observação'].map((h) => bold(h, HEAD)),
    ...entries.map((e) => {
      const r = entryRow(e)
      return [dateCell(r.date), r.type, r.category, r.description, money(r.amount), r.status, dateCell(r.due), dateCell(r.paid), r.method, r.source, r.notes]
    }),
  ]

  const vendas = [
    ['Produto', 'Tipo', 'Quantidade', 'Receita', 'Custo', 'Lucro', 'Variações'].map((h) => bold(h, HEAD)),
    ...products.map((p) => [
      p.product_name,
      p.product_kind === 'kit' ? 'Kit' : 'Produto',
      p.quantity,
      money(p.revenue),
      p.cost_known ? money(p.cost) : 'sem custo',
      p.cost_known ? money(p.profit) : '',
      (p.variants || []).map((v) => `${v.product === p.product_name ? '' : `${v.product}: `}${v.variant} (${v.quantity})`).join(', '),
    ]),
  ]

  await writeExcelFile([
    { data: resumo, sheet: 'Resumo', columns: [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }] },
    {
      data: lancamentos,
      sheet: 'Lançamentos',
      stickyRowsCount: 1,
      columns: [{ width: 12 }, { width: 10 }, { width: 24 }, { width: 40 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 22 }, { width: 30 }],
    },
    {
      data: vendas,
      sheet: 'Vendas por produto',
      stickyRowsCount: 1,
      columns: [{ width: 28 }, { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 50 }],
    },
  ]).toFile(`financeiro_${fileSuffix(from, to)}.xlsx`)
}
