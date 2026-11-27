// Todos os pedidos: busca, filtros por status e período, totais por status
import { useState } from 'react'
import { Link } from 'react-router'
import { ACTIVE_ORDER_STATUSES, ORDER_STATUS, ORDER_STATUS_ORDER } from '../../../constants/orders'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useDebounce } from '../../../hooks/useDebounce'
import { getOrdersSummary, listOrders } from '../../../services/ordersService'
import { formatDateTime } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/money'
import { formatPhone } from '../../../utils/validators'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { StatCard } from '../../../components/admin/StatCard/StatCard'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Pagination } from '../../../components/common/Pagination/Pagination'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { OrderStatusBadge } from '../../../components/shop/OrderStatusBadge/OrderStatusBadge'
import shared from '../adminShared.module.css'
import styles from './Orders.module.css'

const PAGE_SIZE = 25

export default function Orders() {
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' })
  const [page, setPage] = useState(0)
  const search = useDebounce(filters.search, 400)
  const list = useAsync(() => listOrders({ ...filters, search, page, pageSize: PAGE_SIZE }), [search, filters.status, filters.from, filters.to, page])
  const summary = useAsync(() => getOrdersSummary({ from: filters.from, to: filters.to }), [filters.from, filters.to])

  const set = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }))
    setPage(0)
  }
  const byStatus = Object.fromEntries((summary.data || []).map((s) => [s.status, s]))
  const sold = ACTIVE_ORDER_STATUSES.reduce((sum, s) => sum + Number(byStatus[s]?.total_amount || 0), 0)
  const soldCount = ACTIVE_ORDER_STATUSES.reduce((sum, s) => sum + (byStatus[s]?.total_orders || 0), 0)
  const orders = list.data?.orders || []

  return (
    <>
      <PageHeader title="Pedidos" description="Todos os pedidos da loja. Combine o pagamento pelo WhatsApp e atualize o status aqui." />

      <div className={styles.stats}>
        <StatCard
          label="Aguardando pagamento"
          icon="clock"
          value={byStatus.pending?.total_orders ?? 0}
          hint={formatMoney(byStatus.pending?.total_amount || 0)}
        />
        <StatCard label="Vendido (pagos)" icon="check" value={formatMoney(sold)} hint={`${soldCount} pedido(s)`} />
        <StatCard label="Prontos para retirada" icon="bag" value={byStatus.ready?.total_orders ?? 0} />
        <StatCard label="Retirados" icon="check" value={byStatus.picked_up?.total_orders ?? 0} />
      </div>

      <div className={shared.toolbar}>
        <Input label="Buscar" type="search" placeholder="Nº do pedido, nome ou telefone" value={filters.search} onChange={set('search')} />
        <Input as="select" label="Status" value={filters.status} onChange={set('status')}>
          <option value="">Todos</option>
          {ORDER_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS[s].label}
              {byStatus[s] ? ` (${byStatus[s].total_orders})` : ''}
            </option>
          ))}
        </Input>
        <Input label="De" type="date" value={filters.from} onChange={set('from')} />
        <Input label="Até" type="date" value={filters.to} onChange={set('to')} />
      </div>

      {list.loading && <Skeleton height={300} />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && orders.length === 0 && (
        <EmptyState icon="bag" title="Nenhum pedido encontrado" description="Quando alguém fizer um pedido na loja, ele aparece aqui (e você recebe um aviso no sino)." />
      )}

      {!list.loading && orders.length > 0 && (
        <ul className={shared.list}>
          {orders.map((o) => (
            <li key={o.id} className={shared.row}>
              <div className={shared.rowMain}>
                <Link to={ROUTES.ADMIN_ORDER(o.number)} className={shared.rowTitle}>
                  #{o.number} · {o.customer_name || 'Cliente'}
                </Link>
                <span className={shared.rowMeta}>
                  {(o.order_items || []).map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
                </span>
                <span className={shared.rowMeta}>
                  {formatDateTime(o.created_at)}
                  {o.customer_phone && ` · ${formatPhone(o.customer_phone)}`}
                </span>
              </div>
              <div className={shared.rowActions}>
                <strong className={styles.total}>{formatMoney(o.total)}</strong>
                <OrderStatusBadge status={o.status} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={list.data?.total || 0} onChange={setPage} />
    </>
  )
}
