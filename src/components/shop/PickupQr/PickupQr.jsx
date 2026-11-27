// Cartão de retirada (cliente), no estilo de ingresso: degradê e confete
// da marca, logo, QR Code com a logo no centro, picote e número do pedido.
// O QR é gerado no aparelho (biblioteca "qrcode") com correção de erro
// alta ("H"), para continuar legível mesmo com a logo por cima.
import { useEffect, useState } from 'react'
import { ORDER_STATUS } from '../../../constants/orders'
import { useBrand } from '../../../hooks/useBrand'
import { getMyPickupToken, pickupQrContent } from '../../../services/pickupService'
import { cn } from '../../../utils/cn'
import { Icon } from '../../common/Icon/Icon'
import { Skeleton } from '../../common/Skeleton/Skeleton'
import styles from './PickupQr.module.css'

export function PickupQr({ orderId, number, status, customerName, items = [], pickupInfo }) {
  const brand = useBrand()
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const token = await getMyPickupToken(orderId)
        if (!token) throw new Error('sem token')
        const QRCode = (await import('qrcode')).default
        const url = await QRCode.toDataURL(pickupQrContent(token), {
          width: 640,
          margin: 0,
          errorCorrectionLevel: 'H',
          color: { dark: '#1E0A26', light: '#FFFFFF' },
        })
        if (active) setSrc(url)
      } catch {
        if (active) setFailed(true)
      }
    })()
    return () => {
      active = false
    }
  }, [orderId])

  const summary = items.map((i) => `${i.quantity}x ${i.product_name}`).join(' · ')
  const ready = status === 'ready'

  return (
    <div className={styles.wrapper}>
      <article className={styles.ticket}>
        <header className={styles.top}>
          <div className={styles.brand}>
            <img src={brand.logoUrl} alt="" className={styles.logo} />
            <span className={styles.brandName}>{brand.shortName}</span>
          </div>
          <span className={cn(styles.status, ready && styles.statusReady)}>
            <Icon name={ready ? 'bag' : 'check'} size={14} strokeWidth={3} />
            {ORDER_STATUS[status]?.label || 'Pago'}
          </span>
        </header>

        <p className={styles.eyebrow}>Cartão de retirada</p>

        <div className={styles.qrBox}>
          {src ? (
            <>
              <img src={src} alt={`QR Code da retirada do pedido ${number}`} className={styles.qr} />
              <span className={styles.qrLogo} aria-hidden="true">
                <img src={brand.logoUrl} alt="" />
              </span>
            </>
          ) : failed ? (
            <p className={styles.qrError}>Não foi possível gerar o QR Code. Mostre o número do pedido na retirada.</p>
          ) : (
            <Skeleton width="100%" height="100%" />
          )}
        </div>

        {/* picote do ingresso */}
        <div className={styles.perforation} aria-hidden="true" />

        <div className={styles.bottom}>
          <div className={styles.numberRow}>
            <div>
              <span className={styles.label}>Pedido</span>
              <strong className={styles.number}>#{number}</strong>
            </div>
            {customerName && (
              <div className={styles.holder}>
                <span className={styles.label}>Em nome de</span>
                <strong>{customerName}</strong>
              </div>
            )}
          </div>
          {summary && <p className={styles.items}>{summary}</p>}
          {pickupInfo && (
            <div className={styles.where}>
              <Icon name="store" size={16} />
              <p>{pickupInfo}</p>
            </div>
          )}
        </div>
      </article>

      <p className={styles.hint}>
        <Icon name="sun" size={16} /> Aumente o brilho da tela na retirada. Não compartilhe o código: quem tiver ele retira o pedido.
      </p>
    </div>
  )
}
