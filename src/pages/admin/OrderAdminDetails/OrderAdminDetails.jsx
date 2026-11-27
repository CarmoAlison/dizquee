// Pedido no painel: cliente, itens, histórico, WhatsApp e mudança de status
import { useState } from 'react'
import { useParams } from 'react-router'
import { ORDER_ACTION_LABEL, ORDER_PRIMARY_NEXT, ORDER_STATUS, ORDER_TRANSITIONS, PAYMENT_METHODS } from '../../../constants/orders'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { getOrderByNumber, setOrderStatus } from '../../../services/ordersService'
import { getErrorMessage } from '../../../utils/errors'
import { formatDateTime } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/money'
import { formatPhone } from '../../../utils/validators'
import { staffOrderMessage, whatsappLink } from '../../../utils/whatsapp'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { OrderItemsList } from '../../../components/shop/OrderItemsList/OrderItemsList'
import { OrderStatusBadge } from '../../../components/shop/OrderStatusBadge/OrderStatusBadge'
import { OrderTimeline } from '../../../components/shop/OrderTimeline/OrderTimeline'
import shared from '../adminShared.module.css'
import styles from './OrderAdminDetails.module.css'

// O que acontece com o estoque em cada ação (aviso no modal)
function stockNote(from, to) {
  if (!['cancelled', 'refunded'].includes(to)) return ''
  if (from === 'picked_up') return 'Os itens já foram retirados: o estoque não muda (ajuste à mão se o produto voltar).'
  return 'Os itens voltam para o estoque e o lote libera as vagas. Esta ação é definitiva.'
}

export default function OrderAdminDetails() {
  const { number } = useParams()
  const canManage = usePermission(PERMISSIONS.ORDERS_MANAGE)
  const canViewUsers = usePermission(PERMISSIONS.USERS_VIEW)
  const { data: order, loading, error, reload } = useAsync(() => getOrderByNumber(number), [number])
  const [action, setAction] = useState(null)

  if (loading && !order) return <Skeleton height={400} />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!order) {
    return (
      <EmptyState
        icon="bag"
        title="Pedido não encontrado"
        action={
          <Button to={ROUTES.ADMIN_ORDERS} variant="secondary">
            Voltar aos pedidos
          </Button>
        }
      />
    )
  }

  const transitions = ORDER_TRANSITIONS[order.status] || []
  const forward = ORDER_PRIMARY_NEXT[order.status] || []
  const secondary = transitions.filter((s) => !forward.includes(s))

  return (
    <>
      <PageHeader
        title={`Pedido #${order.number}`}
        description={`Feito em ${formatDateTime(order.created_at)}${order.channel === 'presencial' ? ' · venda presencial' : ''}`}
        actions={
          <Button variant="ghost" icon="arrowLeft" to={ROUTES.ADMIN_ORDERS}>
            Pedidos
          </Button>
        }
      />

      <div className={styles.layout}>
        <div className={styles.column}>
          <section className={shared.card}>
            <div className={styles.statusRow}>
              <OrderStatusBadge status={order.status} className={styles.bigBadge} />
              {order.payment_method && <span className={shared.muted}>Pagamento: {PAYMENT_METHODS[order.payment_method]}</span>}
            </div>
            {canManage && transitions.length > 0 && (
              <div className={styles.actions}>
                {forward.map((s) => (
                  <Button key={s} icon={ORDER_STATUS[s].icon} onClick={() => setAction(s)}>
                    {ORDER_ACTION_LABEL[s]}
                  </Button>
                ))}
                {secondary.map((s) => (
                  <Button key={s} variant={['cancelled', 'refunded'].includes(s) ? 'danger' : 'ghost'} size="sm" onClick={() => setAction(s)}>
                    {ORDER_ACTION_LABEL[s]}
                  </Button>
                ))}
              </div>
            )}
            {!canManage && <p className={shared.muted}>Você pode ver o pedido, mas não alterar o status (falta a permissão orders.manage).</p>}
            {transitions.length === 0 && <p className={shared.muted}>Pedido encerrado: não muda mais de status.</p>}
          </section>

          <section className={shared.card} aria-labelledby="itens">
            <h2 id="itens" className={shared.cardTitle}>
              Itens
            </h2>
            <OrderItemsList items={order.order_items} total={order.total} />
          </section>
        </div>

        <div className={styles.column}>
          <section className={shared.card} aria-labelledby="cliente">
            <h2 id="cliente" className={shared.cardTitle}>
              Cliente
            </h2>
            <p className={styles.customer}>{order.customer_name || 'Sem nome'}</p>
            {order.customer_phone && <p className={shared.muted}>{formatPhone(order.customer_phone)}</p>}
            {order.notes && (
              <p className={styles.notes}>
                <strong>Observação:</strong> {order.notes}
              </p>
            )}
            <div className={styles.actions}>
              {order.customer_phone && (
                <Button
                  href={whatsappLink(order.customer_phone, staffOrderMessage(order))}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="accent"
                  icon="whatsapp"
                >
                  Chamar no WhatsApp
                </Button>
              )}
              {order.user_id && canViewUsers && (
                <Button variant="ghost" size="sm" icon="user" to={ROUTES.ADMIN_USER(order.user_id)}>
                  Ver cadastro
                </Button>
              )}
            </div>
          </section>

          <section className={shared.card} aria-labelledby="historico">
            <h2 id="historico" className={shared.cardTitle}>
              Histórico
            </h2>
            <OrderTimeline history={order.order_status_history} showActor />
          </section>
        </div>
      </div>

      {action && (
        <StatusModal
          order={order}
          status={action}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null)
            reload()
          }}
        />
      )}
    </>
  )
}

function StatusModal({ order, status, onClose, onDone }) {
  const toast = useToast()
  const needsPayment = status === 'paid' && order.status === 'pending'
  const [payment, setPayment] = useState(order.payment_method || 'pix')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const danger = ['cancelled', 'refunded'].includes(status)
  const hint = stockNote(order.status, status)

  const confirm = async () => {
    setSaving(true)
    try {
      await setOrderStatus(order.id, status, { note, paymentMethod: needsPayment ? payment : null })
      toast.success(`Pedido #${order.number}: ${ORDER_STATUS[status].label}.`)
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
      title={ORDER_ACTION_LABEL[status]}
      description={`Pedido #${order.number} · ${formatMoney(order.total)} · ${order.customer_name || 'Cliente'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={saving} onClick={confirm}>
            Confirmar
          </Button>
        </>
      }
    >
      <div className={shared.stack}>
        {needsPayment && (
          <Input as="select" label="Forma de pagamento" value={payment} onChange={(e) => setPayment(e.target.value)} required>
            {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Input>
        )}
        <Input
          as="textarea"
          label="Observação (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          hint="Fica no histórico e o cliente também vê."
        />
        {hint && <p className={shared.muted}>{hint}</p>}
        <p className={shared.muted}>O cliente recebe um aviso no site.</p>
      </div>
    </Modal>
  )
}
