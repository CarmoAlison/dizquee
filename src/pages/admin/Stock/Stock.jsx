// Estoque: saldo por variação, reservado, vendido, custo médio, alerta de
// estoque baixo, ajustes com motivo e histórico de movimentações.
import { useMemo, useState } from 'react'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useToast } from '../../../hooks/useToast'
import { MOVEMENT_REASONS, adjustStock, getStockOverview, listMovements, setStockAlert } from '../../../services/stockService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { formatDateTime } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/money'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { StatCard } from '../../../components/admin/StatCard/StatCard'
import { Button } from '../../../components/common/Button/Button'
import { Checkbox } from '../../../components/common/Checkbox/Checkbox'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { Pagination } from '../../../components/common/Pagination/Pagination'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'
import styles from './Stock.module.css'

const isLow = (v) => v.low_stock_alert !== null && v.stock <= v.low_stock_alert

export default function Stock() {
  const { data, loading, error, reload } = useAsync(getStockOverview, [])
  const [search, setSearch] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [adjusting, setAdjusting] = useState(null)
  const [alerting, setAlerting] = useState(null)
  const [history, setHistory] = useState(null) // null | 'all' | variant

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data || []).filter(
      (v) => (!onlyLow || isLow(v)) && (!term || `${v.product_name} ${v.variant_name}`.toLowerCase().includes(term)),
    )
  }, [data, search, onlyLow])

  const totals = useMemo(() => {
    const list = data || []
    return {
      units: list.reduce((s, v) => s + v.stock, 0),
      value: list.reduce((s, v) => s + v.stock * Number(v.avg_cost || 0), 0),
      low: list.filter(isLow).length,
      reserved: list.reduce((s, v) => s + v.reserved, 0),
    }
  }, [data])

  // agrupa as variações por produto
  const groups = useMemo(() => {
    const map = new Map()
    for (const v of rows) {
      if (!map.has(v.product_id)) map.set(v.product_id, { id: v.product_id, name: v.product_name, active: v.product_active, variants: [] })
      map.get(v.product_id).variants.push(v)
    }
    return [...map.values()]
  }, [rows])

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Saldo de cada variação. Pedidos baixam na hora; cancelamentos devolvem."
        actions={
          <>
            <Button variant="secondary" icon="list" onClick={() => setHistory('all')}>
              Movimentações
            </Button>
            <Button icon="truck" to={ROUTES.ADMIN_PURCHASE_NEW}>
              Nova compra
            </Button>
          </>
        }
      />

      <div className={styles.stats}>
        <StatCard label="Unidades em estoque" icon="layers" value={totals.units} />
        <StatCard label="Valor em estoque (custo)" icon="chart" value={formatMoney(totals.value)} hint="Pelo custo médio das compras" />
        <StatCard label="Reservado (aguardando pagamento)" icon="clock" value={totals.reserved} />
        <StatCard label="Com estoque baixo" icon="alert" value={totals.low} />
      </div>

      <div className={shared.toolbar}>
        <Input label="Buscar" type="search" placeholder="Produto ou variação" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Checkbox label="Só estoque baixo" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
      </div>

      {loading && <Skeleton height={300} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && groups.length === 0 && (
        <EmptyState icon="layers" title="Nada por aqui" description={data?.length ? 'Ajuste a busca.' : 'Cadastre produtos e variações em Produtos.'} />
      )}

      <div className={styles.groups}>
        {groups.map((g) => (
          <section key={g.id} className={shared.card}>
            <h2 className={styles.productTitle}>
              {g.name} {!g.active && <span className={cn(shared.badge, shared.badgeWarning)}>Oculto na loja</span>}
            </h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Variação</th>
                    <th scope="col">Estoque</th>
                    <th scope="col">Reservado</th>
                    <th scope="col">Vendido</th>
                    <th scope="col">Custo médio</th>
                    <th scope="col">
                      <span className="visually-hidden">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {g.variants.map((v) => (
                    <tr key={v.variant_id} className={cn(!v.variant_active && styles.inactive)}>
                      <th scope="row">{v.variant_name}</th>
                      <td>
                        <span className={cn(styles.stock, isLow(v) && styles.low, v.stock === 0 && styles.zero)}>{v.stock}</span>
                        {v.low_stock_alert !== null && <span className={styles.alertHint}>alerta ≤ {v.low_stock_alert}</span>}
                      </td>
                      <td>{v.reserved}</td>
                      <td>{v.sold}</td>
                      <td>{v.avg_cost !== null ? formatMoney(v.avg_cost) : '—'}</td>
                      <td className={styles.actions}>
                        <Button size="sm" variant="secondary" onClick={() => setAdjusting(v)}>
                          Ajustar
                        </Button>
                        <Button size="sm" variant="ghost" iconOnly icon="bell" aria-label={`Alerta de ${v.variant_name}`} onClick={() => setAlerting(v)} />
                        <Button size="sm" variant="ghost" iconOnly icon="list" aria-label={`Histórico de ${v.variant_name}`} onClick={() => setHistory(v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      {adjusting && (
        <AdjustModal
          variant={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null)
            reload()
          }}
        />
      )}
      {alerting && (
        <AlertModal
          variant={alerting}
          onClose={() => setAlerting(null)}
          onDone={() => {
            setAlerting(null)
            reload()
          }}
        />
      )}
      {history && <HistoryModal variant={history === 'all' ? null : history} onClose={() => setHistory(null)} />}
    </>
  )
}

function AdjustModal({ variant, onClose, onDone }) {
  const toast = useToast()
  const [direction, setDirection] = useState('out')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const qty = Math.floor(Number(amount) || 0)
  const delta = direction === 'in' ? qty : -qty
  const valid = qty > 0 && note.trim() && variant.stock + delta >= 0

  const save = async () => {
    setSaving(true)
    try {
      const stock = await adjustStock(variant.variant_id, delta, note)
      toast.success(`Estoque de ${variant.variant_name}: ${stock}`)
      onDone()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Ajustar estoque"
      description={`${variant.product_name} · ${variant.variant_name} · hoje: ${variant.stock}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={saving} disabled={!valid} onClick={save}>
            Salvar ajuste
          </Button>
        </>
      }
    >
      <div className={shared.stack}>
        <SegmentedControl
          label="Tipo de ajuste"
          options={[
            { value: 'out', label: 'Saída (perda, brinde…)' },
            { value: 'in', label: 'Entrada (contagem…)' },
          ]}
          value={direction}
          onChange={setDirection}
        />
        <Input label="Quantidade" type="number" min="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} data-autofocus />
        <Input
          label="Motivo"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          required
          placeholder="Ex.: peça com defeito, brinde para a bateria, contagem física"
        />
        {qty > 0 && (
          <p className={shared.muted}>
            Novo estoque: <strong>{variant.stock + delta}</strong>
            {variant.stock + delta < 0 && ' (não pode ficar negativo)'}
          </p>
        )}
        <p className={shared.muted}>Entrada de mercadoria comprada? Use “Nova compra”, que também registra o custo.</p>
      </div>
    </Modal>
  )
}

function AlertModal({ variant, onClose, onDone }) {
  const toast = useToast()
  const [value, setValue] = useState(variant.low_stock_alert ?? '')
  const [saving, setSaving] = useState(false)
  const save = async (alert) => {
    setSaving(true)
    try {
      await setStockAlert(variant.variant_id, alert)
      onDone()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Alerta de estoque baixo"
      description={`${variant.product_name} · ${variant.variant_name}`}
      footer={
        <>
          {variant.low_stock_alert !== null && (
            <Button variant="ghost" onClick={() => save(null)}>
              Remover alerta
            </Button>
          )}
          <Button loading={saving} disabled={value === ''} onClick={() => save(Math.max(0, Math.floor(Number(value))))}>
            Salvar
          </Button>
        </>
      }
    >
      <Input
        label="Avisar quando o estoque chegar a"
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        suffix="un."
        data-autofocus
      />
    </Modal>
  )
}

const PAGE_SIZE = 30

function HistoryModal({ variant, onClose }) {
  const [page, setPage] = useState(0)
  const [reason, setReason] = useState('')
  const { data, loading, error, reload } = useAsync(
    () => listMovements({ variantId: variant?.variant_id || null, reason, page, pageSize: PAGE_SIZE }),
    [variant?.variant_id, reason, page],
  )
  const list = data?.movements || []

  return (
    <Modal open onClose={onClose} size="lg" title="Movimentações" description={variant ? `${variant.product_name} · ${variant.variant_name}` : 'Todas as variações'}>
      <div className={shared.stack}>
        <Input
          as="select"
          label="Tipo"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setPage(0)
          }}
        >
          <option value="">Todos</option>
          {Object.entries(MOVEMENT_REASONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Input>
        {loading && <Skeleton height={200} />}
        {error && <ErrorState error={error} onRetry={reload} compact />}
        {!loading && !error && list.length === 0 && <p className={shared.muted}>Nenhuma movimentação.</p>}
        {!loading && list.length > 0 && (
          <ul className={styles.movements}>
            {list.map((m) => (
              <li key={m.id} className={styles.movement}>
                <span className={cn(styles.delta, m.quantity > 0 ? styles.deltaIn : styles.deltaOut)}>
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                </span>
                <div className={styles.movementMain}>
                  <strong>
                    {MOVEMENT_REASONS[m.reason] || m.reason}
                    {m.orders?.number && ` · pedido #${m.orders.number}`}
                  </strong>
                  {!variant && (
                    <span className={shared.muted}>
                      {m.product_variants?.products?.name} · {m.product_variants?.name}
                    </span>
                  )}
                  {m.note && <span className={shared.muted}>{m.note}</span>}
                  <span className={shared.muted}>
                    {formatDateTime(m.created_at)}
                    {m.actor && ` · ${m.actor.full_name || `@${m.actor.username}`}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onChange={setPage} />
      </div>
    </Modal>
  )
}
