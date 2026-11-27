// Detalhe do pedido (cliente): itens, andamento, WhatsApp do bloco,
// informações de retirada e cancelamento enquanto aguarda pagamento.
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { ORDER_STATUS } from '../../../constants/orders'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useBrand } from '../../../hooks/useBrand'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useToast } from '../../../hooks/useToast'
import { cancelMyOrder, getOrderByNumber } from '../../../services/ordersService'
import { getShopSettings } from '../../../services/shopService'
import { formatDateTime } from '../../../utils/formatDate'
import { formatPhone } from '../../../utils/validators'
import { customerOrderMessage, whatsappLink } from '../../../utils/whatsapp'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Icon } from '../../../components/common/Icon/Icon'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { OrderItemsList } from '../../../components/shop/OrderItemsList/OrderItemsList'
import { OrderStatusBadge } from '../../../components/shop/OrderStatusBadge/OrderStatusBadge'
import { OrderTimeline } from '../../../components/shop/OrderTimeline/OrderTimeline'
import { PickupQr } from '../../../components/shop/PickupQr/PickupQr'
import shop from '../shop.module.css'
import styles from './OrderDetails.module.css'

// O que o cliente precisa fazer agora, por status
const NEXT_STEP = {
  pending: 'Mande o pedido para o bloco pelo WhatsApp e combine o pagamento. Assim que o pagamento for confirmado, o status muda aqui.',
  paid: 'Pagamento confirmado! Agora é só aguardar: avisaremos quando estiver pronto para retirada.',
  ready: 'Seu pedido está pronto. Vá ao local de retirada e mostre o QR Code abaixo.',
  picked_up: 'Pedido retirado. Bom carnaval!',
  cancelled: 'Este pedido foi cancelado.',
  refunded: 'Este pedido foi reembolsado.',
}

export default function OrderDetails() {
  const { number } = useParams()
  const [params] = useSearchParams()
  const isNew = params.get('novo') === '1'
  const { name: brandName } = useBrand()
  const toast = useToast()
  const order = useAsync(() => getOrderByNumber(number), [number])
  const settings = useAsync(getShopSettings, [])
  const [cancelOpen, setCancelOpen] = useState(false)
  useDocumentTitle(`Pedido #${number}`, { noindex: true })

  if (order.loading) {
    return (
      <div className={`container ${shop.page} ${shop.narrow}`}>
        <Skeleton height={140} />
        <Skeleton height={260} />
      </div>
    )
  }
  if (order.error) {
    return (
      <div className={`container ${shop.page} ${shop.narrow}`}>
        <ErrorState error={order.error} onRetry={order.reload} />
      </div>
    )
  }
  const o = order.data
  if (!o) {
    return (
      <div className={`container ${shop.page} ${shop.narrow}`}>
        <EmptyState
          icon="bag"
          title="Pedido não encontrado"
          action={
            <Button to={ROUTES.MY_ORDERS} variant="secondary">
              Meus pedidos
            </Button>
          }
        />
      </div>
    )
  }

  const bloco = settings.data?.whatsapp_number
  const waHref = bloco ? whatsappLink(bloco, customerOrderMessage(o, brandName)) : ''
  const active = !['cancelled', 'refunded'].includes(o.status)

  return (
    <div className={`container ${shop.page} ${shop.narrow}`}>
      <Button to={ROUTES.MY_ORDERS} variant="ghost" size="sm" icon="arrowLeft" className={shop.back}>
        Meus pedidos
      </Button>

      {isNew && o.status === 'pending' && (
        <section className={styles.success} aria-live="polite">
          <span className={styles.successIcon} aria-hidden="true">
            <Icon name="check" size={28} strokeWidth={3} />
          </span>
          <h1 className={styles.successTitle}>Pedido #{o.number} feito!</h1>
          <p>Seu estoque está reservado. Agora envie o pedido pelo WhatsApp para combinar o pagamento.</p>
          {waHref && (
            <Button href={waHref} target="_blank" rel="noopener noreferrer" variant="accent" size="lg" icon="whatsapp">
              Enviar pelo WhatsApp
            </Button>
          )}
        </section>
      )}

      <section className={shop.card}>
        <div className={styles.header}>
          <div>
            {!(isNew && o.status === 'pending') && <h1 className={shop.title}>Pedido #{o.number}</h1>}
            <p className={shop.muted}>Feito em {formatDateTime(o.created_at)}</p>
          </div>
          <OrderStatusBadge status={o.status} />
        </div>
        <p className={styles.nextStep}>
          <Icon name={ORDER_STATUS[o.status]?.icon || 'clock'} size={18} />
          {NEXT_STEP[o.status]}
        </p>
        {active && (
          <div className={shop.actions}>
            {waHref && !(isNew && o.status === 'pending') && (
              <Button href={waHref} target="_blank" rel="noopener noreferrer" variant="accent" icon="whatsapp">
                Falar com o bloco no WhatsApp
              </Button>
            )}
            {o.status === 'pending' && (
              <Button variant="ghost" icon="ban" onClick={() => setCancelOpen(true)}>
                Cancelar pedido
              </Button>
            )}
          </div>
        )}
        {!bloco && active && settings.data && (
          <p className={shop.muted}>O WhatsApp do bloco ainda não foi configurado. A equipe vai entrar em contato com você.</p>
        )}
      </section>

      {['paid', 'ready'].includes(o.status) && (
        <section aria-label="Cartão de retirada">
          <PickupQr
            orderId={o.id}
            number={o.number}
            status={o.status}
            customerName={o.customer_name}
            items={o.order_items}
            pickupInfo={settings.data?.pickup_info}
          />
        </section>
      )}

      <section className={shop.card} aria-labelledby="itens">
        <h2 id="itens" className={shop.cardTitle}>
          Itens
        </h2>
        <OrderItemsList items={o.order_items} total={o.total} />
        <p className={shop.muted}>
          WhatsApp informado: {formatPhone(o.customer_phone)}
          {o.notes && (
            <>
              <br />
              Observação: {o.notes}
            </>
          )}
        </p>
      </section>

      <section className={shop.card} aria-labelledby="andamento">
        <h2 id="andamento" className={shop.cardTitle}>
          Andamento
        </h2>
        <OrderTimeline history={o.order_status_history} />
      </section>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => {
          await cancelMyOrder(o.id)
          toast.success('Pedido cancelado.')
          order.reload()
        }}
        title={`Cancelar o pedido #${o.number}?`}
        description="Os itens voltam para o estoque e podem ser comprados por outras pessoas."
        confirmLabel="Cancelar pedido"
      />
    </div>
  )
}
