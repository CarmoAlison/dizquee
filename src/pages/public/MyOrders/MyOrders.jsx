// Meus pedidos: número, data, itens, total e status
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { listMyOrders } from '../../../services/ordersService'
import { formatDateTime } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/money'
import { Button } from '../../../components/common/Button/Button'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { OrderStatusBadge } from '../../../components/shop/OrderStatusBadge/OrderStatusBadge'
import shop from '../shop.module.css'
import styles from './MyOrders.module.css'

export default function MyOrders() {
  useDocumentTitle('Meus pedidos', { noindex: true })
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync(() => listMyOrders(user.id), [user?.id], { enabled: Boolean(user?.id) })
  const orders = data || []

  return (
    <div className={`container ${shop.page} ${shop.narrow}`}>
      <h1 className={shop.title}>Meus pedidos</h1>

      {loading && (
        <div className={styles.list}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={88} />
          ))}
        </div>
      )}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && orders.length === 0 && (
        <EmptyState
          icon="bag"
          title="Você ainda não fez pedidos"
          description="Seus pedidos da loja aparecem aqui, com o andamento de cada um."
          action={
            <Button to={ROUTES.SHOP} icon="bag">
              Ir para a loja
            </Button>
          }
        />
      )}
      {!loading && orders.length > 0 && (
        <ul className={styles.list}>
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={ROUTES.MY_ORDER(o.number)} className={styles.row}>
                <div className={styles.main}>
                  <span className={styles.number}>Pedido #{o.number}</span>
                  <span className={styles.items}>{(o.order_items || []).map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}</span>
                  <span className={styles.date}>{formatDateTime(o.created_at)}</span>
                </div>
                <div className={styles.side}>
                  <OrderStatusBadge status={o.status} />
                  <strong>{formatMoney(o.total)}</strong>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
