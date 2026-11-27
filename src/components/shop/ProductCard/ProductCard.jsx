// Cartão do produto na vitrine: foto, nome, preço do lote vigente e situação
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { productImageUrl, saleState } from '../../../services/shopService'
import { cn } from '../../../utils/cn'
import { formatShortDay } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/money'
import { Icon } from '../../common/Icon/Icon'
import styles from './ProductCard.module.css'

export function ProductCard({ product }) {
  const state = saleState(product)
  const cover = product.images?.[0]?.storage_path
  const price = product.lot?.price ?? product.next_lot?.price

  return (
    <Link to={ROUTES.PRODUCT(product.slug)} className={cn(styles.card, state !== 'available' && styles.dimmed)}>
      <div className={styles.media}>
        {cover ? (
          <img src={productImageUrl(cover, { width: 600 })} alt="" loading="lazy" decoding="async" className={styles.image} />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            <Icon name="bag" size={40} />
          </span>
        )}
        {state === 'available' && product.lot && <span className={styles.lot}>{product.lot.name}</span>}
        {state === 'soldout' && <span className={cn(styles.lot, styles.soldout)}>Esgotado</span>}
        {state === 'soon' && <span className={cn(styles.lot, styles.soon)}>Em breve</span>}
        {product.kind === 'kit' && <span className={styles.kit}>Kit</span>}
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>{product.name}</h3>
        {price !== undefined && price !== null && <p className={styles.price}>{formatMoney(price)}</p>}
        {state === 'available' && product.lot?.remaining !== null && product.lot?.remaining <= 10 && (
          <p className={styles.hint}>Últimas {product.lot.remaining} no {product.lot.name.toLowerCase()}</p>
        )}
        {state === 'soon' && product.next_lot?.starts_at && <p className={styles.hint}>A partir de {formatShortDay(product.next_lot.starts_at)}</p>}
      </div>
    </Link>
  )
}
