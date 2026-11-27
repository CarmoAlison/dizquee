// Financeiro: visão geral do período (entradas, saídas, saldo, pendências),
// gráfico, categorias, vendas por produto com lucro e exportações.
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState } from 'react'
import { Link } from 'react-router'
import { ENTRY_TYPES } from '../../../constants/finance'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useBrand } from '../../../hooks/useBrand'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { getFinanceSummary, getFinanceTimeseries, getProductSales, listAllEntries } from '../../../services/financeService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { exportEntriesCsv, exportFinanceXlsx } from '../../../utils/financeExport'
import { formatMoney } from '../../../utils/money'
import { presetRange, suggestedGroup } from '../../../utils/period'
import { FinanceChart } from '../../../components/admin/FinanceChart/FinanceChart'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { PeriodPicker } from '../../../components/admin/PeriodPicker/PeriodPicker'
import { StatCard } from '../../../components/admin/StatCard/StatCard'
import { Button } from '../../../components/common/Button/Button'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'
import styles from './FinanceDashboard.module.css'

function bucketLabel(date, group) {
  const d = parseISO(date)
  return format(d, group === 'month' ? 'MMM/yy' : 'dd/MM', { locale: ptBR })
}

export default function FinanceDashboard() {
  const toast = useToast()
  const canManage = usePermission(PERMISSIONS.FINANCE_MANAGE)
  const { name: brandName } = useBrand()
  const [period, setPeriod] = useState(() => ({ preset: 'month', ...presetRange('month') }))
  const [groupChoice, setGroupChoice] = useState('auto')
  const [exporting, setExporting] = useState('')
  const { from, to } = period
  const group = groupChoice === 'auto' ? suggestedGroup(from, to) : groupChoice

  const summary = useAsync(() => getFinanceSummary(from, to), [from, to])
  const series = useAsync(() => getFinanceTimeseries(from, to, group), [from, to, group])
  const products = useAsync(() => getProductSales(from, to), [from, to])

  const s = summary.data
  const balance = s ? Number(s.income_paid) - Number(s.expense_paid) : 0
  const productList = products.data || []
  const totals = productList.reduce(
    (acc, p) => ({ revenue: acc.revenue + p.revenue, cost: acc.cost + p.cost, profit: acc.profit + p.profit, qty: acc.qty + p.quantity }),
    { revenue: 0, cost: 0, profit: 0, qty: 0 },
  )

  const runExport = async (kind) => {
    setExporting(kind)
    try {
      const entries = await listAllEntries({ from, to })
      if (kind === 'csv') exportEntriesCsv(entries, { from, to })
      else await exportFinanceXlsx({ brandName, from, to, summary: s, entries, products: productList })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Não foi possível exportar.'))
    } finally {
      setExporting('')
    }
  }

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Receitas e despesas do bloco. Vendas pagas e compras de fornecedor entram sozinhas."
        actions={
          canManage && (
            <Button icon="plus" to={ROUTES.ADMIN_FINANCE_ENTRIES + '?novo=1'}>
              Novo lançamento
            </Button>
          )
        }
      />

      <div className={cn(shared.card, styles.periodBar)}>
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className={styles.exports}>
          <Button size="sm" variant="secondary" icon="posts" loading={exporting === 'csv'} disabled={!s} onClick={() => runExport('csv')}>
            CSV
          </Button>
          <Button size="sm" variant="secondary" icon="list" loading={exporting === 'xlsx'} disabled={!s} onClick={() => runExport('xlsx')}>
            Excel
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="external"
            href={`${ROUTES.ADMIN_FINANCE_REPORT}?from=${from}&to=${to}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            PDF
          </Button>
        </div>
      </div>

      {summary.error && <ErrorState error={summary.error} onRetry={summary.reload} />}
      {summary.loading && !s && <Skeleton height={120} />}
      {s && (
        <>
          {Number(s.overdue_count) > 0 && (
            <Link to={`${ROUTES.ADMIN_FINANCE_ENTRIES}?vencidos=1`} className={styles.overdue}>
              {s.overdue_count} lançamento(s) vencido(s): {formatMoney(s.overdue_expense)} a pagar
              {Number(s.overdue_income) > 0 && ` · ${formatMoney(s.overdue_income)} a receber`} →
            </Link>
          )}
          <div className={styles.stats}>
            <StatCard label="Entradas" icon="chevronUp" value={formatMoney(s.income_paid)} hint="Recebidas no período" />
            <StatCard label="Saídas" icon="chevronDown" value={formatMoney(s.expense_paid)} hint="Pagas no período" />
            <StatCard label="Saldo" icon="chart" value={formatMoney(balance)} hint={balance >= 0 ? 'Entrou mais do que saiu' : 'Saiu mais do que entrou'} />
            <StatCard label="A pagar" icon="clock" value={formatMoney(s.expense_pending)} hint="Vencendo no período" />
            <StatCard label="A receber" icon="clock" value={formatMoney(s.income_pending)} hint="Vencendo no período" />
          </div>
        </>
      )}

      <section className={shared.card}>
        <div className={styles.sectionHead}>
          <h2 className={shared.cardTitle}>Entradas e saídas</h2>
          <SegmentedControl
            label="Agrupar por"
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'day', label: 'Dia' },
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mês' },
            ]}
            value={groupChoice}
            onChange={setGroupChoice}
          />
        </div>
        {series.loading && !series.data ? (
          <Skeleton height={200} />
        ) : series.error ? (
          <ErrorState error={series.error} onRetry={series.reload} compact />
        ) : (
          <FinanceChart data={(series.data || []).map((r) => ({ label: bucketLabel(r.bucket, group), income: r.income, expense: r.expense }))} />
        )}
      </section>

      <div className={styles.columns}>
        <section className={shared.card}>
          <h2 className={shared.cardTitle}>Por categoria</h2>
          {s && s.by_category.length === 0 && <p className={shared.muted}>Nenhum lançamento no período.</p>}
          {s &&
            ['income', 'expense'].map((type) => {
              const list = s.by_category.filter((c) => c.type === type)
              if (!list.length) return null
              const max = Math.max(...list.map((c) => Number(c.paid || 0) + Number(c.pending || 0)))
              return (
                <div key={type} className={styles.catGroup}>
                  <h3 className={styles.catTitle}>{ENTRY_TYPES[type].plural}</h3>
                  <ul className={styles.catList}>
                    {list.map((c) => {
                      const paid = Number(c.paid || 0)
                      const pending = Number(c.pending || 0)
                      return (
                        <li key={c.category_id}>
                          <div className={styles.catRow}>
                            <span>{c.name}</span>
                            <strong>{formatMoney(paid + pending)}</strong>
                          </div>
                          <div className={styles.catBar} aria-hidden="true">
                            <span
                              className={cn(styles.catFill, type === 'income' ? styles.fillIncome : styles.fillExpense)}
                              style={{ width: `${(paid / max) * 100}%` }}
                            />
                            <span className={styles.catPending} style={{ width: `${(pending / max) * 100}%` }} />
                          </div>
                          {pending > 0 && <span className={shared.muted}>{formatMoney(pending)} pendente</span>}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
        </section>

        <section className={shared.card}>
          <h2 className={shared.cardTitle}>Vendas por produto</h2>
          <p className={shared.muted}>Pedidos pagos no período. Custo pelo custo médio das compras.</p>
          {products.loading && !products.data && <Skeleton height={160} />}
          {products.error && <ErrorState error={products.error} onRetry={products.reload} compact />}
          {products.data && productList.length === 0 && <p className={shared.muted}>Nenhuma venda no período.</p>}
          {productList.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Qtd.</th>
                    <th scope="col">Receita</th>
                    <th scope="col">Custo</th>
                    <th scope="col">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {productList.map((p) => (
                    <tr key={p.product_id}>
                      <th scope="row">
                        {p.product_name}
                        <span className={styles.variants}>
                          {(p.variants || [])
                            .map((v) => `${v.product === p.product_name ? '' : `${v.product} `}${v.variant === 'Único' ? '' : v.variant} ×${v.quantity}`.trim())
                            .join(' · ')}
                        </span>
                      </th>
                      <td>{p.quantity}</td>
                      <td>{formatMoney(p.revenue)}</td>
                      <td>{p.cost_known ? formatMoney(p.cost) : <span title="Registre compras com custo para calcular">—</span>}</td>
                      <td className={cn(p.cost_known && (p.profit >= 0 ? styles.positive : styles.negative))}>{p.cost_known ? formatMoney(p.profit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td>{totals.qty}</td>
                    <td>{formatMoney(totals.revenue)}</td>
                    <td>{formatMoney(totals.cost)}</td>
                    <td>{formatMoney(totals.profit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {productList.some((p) => !p.cost_known) && (
            <p className={shared.muted}>“—” = produto sem custo registrado (cadastre a compra em Compras para calcular o lucro).</p>
          )}
        </section>
      </div>
    </>
  )
}
