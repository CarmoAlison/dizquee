// Retirada: lê o QR Code do cliente (ou busca pelo número) e confirma.
// Pensada para o celular. Abrir o link do QR com a câmera comum do
// aparelho também cai aqui, já com o pedido (?t=token).
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ORDER_STATUS } from '../../../constants/orders'
import { useToast } from '../../../hooks/useToast'
import { confirmPickup, extractPickupToken, lookupPickup } from '../../../services/pickupService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { formatDateTime } from '../../../utils/formatDate'
import { formatPhone } from '../../../utils/validators'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { QrScanner } from '../../../components/admin/QrScanner/QrScanner'
import { Button } from '../../../components/common/Button/Button'
import { Icon } from '../../../components/common/Icon/Icon'
import { Input } from '../../../components/common/Input/Input'
import { Loader } from '../../../components/common/Loader/Loader'
import { OrderItemsList } from '../../../components/shop/OrderItemsList/OrderItemsList'
import { OrderStatusBadge } from '../../../components/shop/OrderStatusBadge/OrderStatusBadge'
import shared from '../adminShared.module.css'
import styles from './Checkin.module.css'

export default function Checkin() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [scanning, setScanning] = useState(false)
  const [number, setNumber] = useState('')
  const [order, setOrder] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)

  const lookup = useCallback(
    async (query) => {
      setLoading(true)
      setNotFound(false)
      setDone(false)
      try {
        const found = await lookupPickup(query)
        setOrder(found)
        setNotFound(!found)
        if (found) setScanning(false)
      } catch (err) {
        toast.error(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  // Link do QR aberto pela câmera do celular: /admin/retirada?t=...
  const urlToken = params.get('t')
  useEffect(() => {
    if (!urlToken) return
    // busca fora do ciclo do efeito e limpa o token da barra de endereço
    const timer = setTimeout(() => lookup({ token: urlToken }).finally(() => setParams({}, { replace: true })), 0)
    return () => clearTimeout(timer)
  }, [urlToken, lookup, setParams])

  const onScan = (text) => {
    const token = extractPickupToken(text)
    if (!token) {
      toast.error('Este QR Code não é de um pedido da loja.')
      return
    }
    navigator.vibrate?.(80)
    lookup({ token })
  }

  const confirm = async () => {
    setConfirming(true)
    try {
      await confirmPickup(order.id)
      setDone(true)
      setOrder((o) => ({ ...o, status: 'picked_up', picked_up_at: new Date().toISOString() }))
      toast.success(`Pedido #${order.number} retirado!`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setConfirming(false)
    }
  }

  const reset = () => {
    setOrder(null)
    setNotFound(false)
    setDone(false)
    setNumber('')
    setScanning(true)
  }

  const canPickUp = order && ['paid', 'ready'].includes(order.status) && !done

  return (
    <>
      <PageHeader title="Retirada" description="Leia o QR Code do cliente ou busque pelo número do pedido." />

      <div className={styles.layout}>
        <section className={cn(shared.card, styles.reader)}>
          {scanning ? (
            <>
              <QrScanner onResult={onScan} paused={loading} />
              <Button variant="ghost" icon="close" onClick={() => setScanning(false)}>
                Fechar câmera
              </Button>
            </>
          ) : (
            <Button size="lg" icon="camera" fullWidth onClick={() => setScanning(true)}>
              Ler QR Code
            </Button>
          )}
          <form
            className={styles.search}
            onSubmit={(e) => {
              e.preventDefault()
              const n = number.replace(/\D/g, '')
              if (n) lookup({ number: n })
            }}
          >
            <Input label="Número do pedido" inputMode="numeric" placeholder="Ex.: 1024" prefix="#" value={number} onChange={(e) => setNumber(e.target.value)} />
            <Button type="submit" variant="secondary" icon="search" disabled={!number.trim()}>
              Buscar
            </Button>
          </form>
        </section>

        <section className={styles.result} aria-live="polite">
          {loading && <Loader />}
          {notFound && !loading && (
            <div className={cn(styles.banner, styles.bannerDanger)}>
              <Icon name="alert" size={28} />
              <div>
                <strong>Pedido não encontrado</strong>
                <p>Confira o número ou peça para o cliente abrir o pedido no celular.</p>
              </div>
            </div>
          )}
          {order && !loading && (
            <div className={cn(shared.card, shared.stack)}>
              {done || order.status === 'picked_up' ? (
                <div className={cn(styles.banner, done ? styles.bannerSuccess : styles.bannerDanger)}>
                  <Icon name={done ? 'check' : 'alert'} size={28} />
                  <div>
                    <strong>{done ? 'Retirada confirmada!' : 'Este pedido JÁ FOI RETIRADO'}</strong>
                    {!done && (
                      <p>
                        Em {formatDateTime(order.picked_up_at)}
                        {order.picked_up_by && ` por ${order.picked_up_by}`}.
                      </p>
                    )}
                  </div>
                </div>
              ) : !canPickUp ? (
                <div className={cn(styles.banner, styles.bannerDanger)}>
                  <Icon name="ban" size={28} />
                  <div>
                    <strong>Não entregar: {ORDER_STATUS[order.status]?.label}</strong>
                    <p>{order.status === 'pending' ? 'O pagamento ainda não foi confirmado.' : 'Este pedido não vale mais.'}</p>
                  </div>
                </div>
              ) : (
                <div className={cn(styles.banner, styles.bannerSuccess)}>
                  <Icon name="check" size={28} />
                  <div>
                    <strong>Pode entregar</strong>
                    <p>Pago{order.paid_at ? ` em ${formatDateTime(order.paid_at)}` : ''}. Confira os itens abaixo.</p>
                  </div>
                </div>
              )}

              <div className={styles.head}>
                <div>
                  <p className={styles.number}>#{order.number}</p>
                  <p className={styles.customer}>{order.customer_name || 'Cliente'}</p>
                  {order.customer_phone && <p className={shared.muted}>{formatPhone(order.customer_phone)}</p>}
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <OrderItemsList items={order.items} total={order.total} />
              {order.notes && (
                <p className={shared.muted}>
                  <strong>Observação:</strong> {order.notes}
                </p>
              )}

              {canPickUp && (
                <Button size="lg" icon="check" fullWidth loading={confirming} onClick={confirm}>
                  Confirmar retirada
                </Button>
              )}
              <Button variant="secondary" icon="qr" fullWidth onClick={reset}>
                Ler o próximo
              </Button>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
