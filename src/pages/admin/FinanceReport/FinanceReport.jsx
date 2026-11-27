// Relatório financeiro para imprimir / salvar em PDF, com a cara do
// sistema (logo, nome e cores da marca). Abre em nova aba, fora do layout
// do painel; "Salvar PDF" usa a impressão do navegador (Salvar como PDF),
// que mantém texto pesquisável e não precisa de biblioteca extra.
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ENTRY_SOURCES, ENTRY_TYPES, statusLabel } from '../../../constants/finance'
import { useAsync } from '../../../hooks/useAsync'
import { useBrand } from '../../../hooks/useBrand'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { getFinanceSummary, getProductSales, listAllEntries } from '../../../services/financeService'
import { cn } from '../../../utils/cn'
import { formatDateTime } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/money'
import { presetRange } from '../../../utils/period'
import { Button } from '../../../components/common/Button/Button'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Loader } from '../../../components/common/Loader/Loader'
import styles from './FinanceReport.module.css'

const short = (d) => {
  const [y, m, day] = String(d).split('-')
  return `${day}/${m}/${y}`
}

export default function FinanceReport() {
  const [params] = useSearchParams()
  const fallback = presetRange('month')
  const from = params.get('from') || fallback.from
  const to = params.get('to') || fallback.to
  const brand = useBrand()
  useDocumentTitle(`Relatório financeiro ${short(from)} a ${short(to)}`, { noindex: true })

  // momento da geração (fixo durante a vida da página)
  const [generatedAt] = useState(() => new Date())
  const { data, loading, error, reload } = useAsync(async () => {
    const [summary, entries, products] = await Promise.all([getFinanceSummary(from, to), listAllEntries({ from, to }), getProductSales(from, to)])
    return { summary, entries, products }
  }, [from, to])

  if (loading) return <Loader fullPage />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const { summary: s, entries, products } = data
  const balance = Number(s.income_paid) - Number(s.expense_paid)
  const totals = products.reduce((a, p) => ({ revenue: a.revenue + p.revenue, cost: a.cost + p.cost, profit: a.profit + p.profit }), {
    revenue: 0,
    cost: 0,
    profit: 0,
  })

  return (
    <div className={styles.page}>
      <div className={styles.toolbar} data-print="hide">
        <Button icon="arrowLeft" variant="ghost" onClick={() => window.close()}>
          Fechar
        </Button>
        <Button icon="upload" onClick={() => window.print()}>
          Salvar PDF / Imprimir
        </Button>
        <p className={styles.tip}>Na janela de impressão, escolha “Salvar como PDF” e ative “Gráficos de plano de fundo” para manter as cores.</p>
      </div>

      <article className={styles.sheet}>
        <header className={styles.header}>
          <img src={brand.logoUrl} alt="" className={styles.logo} />
          <div>
            <p className={styles.brand}>{brand.name}</p>
            <h1 className={styles.title}>Relatório financeiro</h1>
            <p className={styles.period}>
              {short(from)} a {short(to)}
            </p>
          </div>
        </header>

        <section className={styles.cards}>
          <div className={styles.card}>
            <span>Entradas</span>
            <strong className={styles.income}>{formatMoney(s.income_paid)}</strong>
          </div>
          <div className={styles.card}>
            <span>Saídas</span>
            <strong className={styles.expense}>{formatMoney(s.expense_paid)}</strong>
          </div>
          <div className={cn(styles.card, styles.cardMain)}>
            <span>Saldo</span>
            <strong>{formatMoney(balance)}</strong>
          </div>
          <div className={styles.card}>
            <span>A receber</span>
            <strong>{formatMoney(s.income_pending)}</strong>
          </div>
          <div className={styles.card}>
            <span>A pagar</span>
            <strong>{formatMoney(s.expense_pending)}</strong>
          </div>
        </section>
        {Number(s.overdue_expense) > 0 && <p className={styles.alert}>Atenção: {formatMoney(s.overdue_expense)} em despesas vencidas.</p>}

        <section className={styles.section}>
          <h2>Por categoria</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Tipo</th>
                <th className={styles.num}>Pago / recebido</th>
                <th className={styles.num}>Pendente</th>
              </tr>
            </thead>
            <tbody>
              {s.by_category.map((c) => (
                <tr key={c.category_id}>
                  <td>
                    <span className={styles.swatch} style={{ background: c.color || '#ccc' }} />
                    {c.name}
                  </td>
                  <td>{ENTRY_TYPES[c.type].label}</td>
                  <td className={styles.num}>{formatMoney(c.paid || 0)}</td>
                  <td className={styles.num}>{formatMoney(c.pending || 0)}</td>
                </tr>
              ))}
              {s.by_category.length === 0 && (
                <tr>
                  <td colSpan={4}>Nenhum lançamento no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {products.length > 0 && (
          <section className={styles.section}>
            <h2>Vendas por produto</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className={styles.num}>Qtd.</th>
                  <th className={styles.num}>Receita</th>
                  <th className={styles.num}>Custo</th>
                  <th className={styles.num}>Lucro</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_id}>
                    <td>{p.product_name}</td>
                    <td className={styles.num}>{p.quantity}</td>
                    <td className={styles.num}>{formatMoney(p.revenue)}</td>
                    <td className={styles.num}>{p.cost_known ? formatMoney(p.cost) : '—'}</td>
                    <td className={styles.num}>{p.cost_known ? formatMoney(p.profit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className={styles.num}>{products.reduce((a, p) => a + p.quantity, 0)}</td>
                  <td className={styles.num}>{formatMoney(totals.revenue)}</td>
                  <td className={styles.num}>{formatMoney(totals.cost)}</td>
                  <td className={styles.num}>{formatMoney(totals.profit)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        <section className={styles.section}>
          <h2>Lançamentos ({entries.length})</h2>
          <table className={cn(styles.table, styles.small)}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Situação</th>
                <th className={styles.num}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{short(e.ref_date)}</td>
                  <td>
                    {e.description}
                    {e.source !== 'manual' && <span className={styles.source}> · {ENTRY_SOURCES[e.source]}</span>}
                  </td>
                  <td>{e.finance_categories?.name}</td>
                  <td>{statusLabel(e.type, e.status)}</td>
                  <td className={cn(styles.num, e.type === 'income' ? styles.income : styles.expense)}>
                    {e.type === 'income' ? '+' : '−'} {formatMoney(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className={styles.footer}>
          Gerado em {formatDateTime(generatedAt)} · {brand.name}
        </footer>
      </article>
    </div>
  )
}
