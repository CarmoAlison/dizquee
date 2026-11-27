// Itens de um pedido: produto, lote, escolhas, nomes e subtotal
import { formatMoney } from '../../../utils/money'
import styles from './OrderItemsList.module.css'

export function OrderItemsList({ items = [], total }) {
  return (
    <div className={styles.wrapper}>
      <ul className={styles.list}>
        {items.map((item) => {
          const parts = (item.order_item_parts || []).filter((p) => item.product_kind === 'kit' || p.variant_name !== 'Único')
          return (
            <li key={item.id} className={styles.item}>
              <div className={styles.main}>
                <span className={styles.name}>
                  {item.quantity}x {item.product_name}
                </span>
                {parts.length > 0 && (
                  <span className={styles.detail}>
                    {parts
                      .map((p) => (item.product_kind === 'kit' ? `${p.product_name}: ${p.variant_name}` : p.variant_name))
                      .join(' · ')}
                  </span>
                )}
                {item.holder_names?.length > 0 && <span className={styles.detail}>Nomes: {item.holder_names.join(', ')}</span>}
                <span className={styles.lot}>
                  {item.lot_name} · {formatMoney(item.unit_price)} cada
                </span>
              </div>
              <span className={styles.subtotal}>{formatMoney(item.unit_price * item.quantity)}</span>
            </li>
          )
        })}
      </ul>
      {total !== undefined && (
        <div className={styles.total}>
          <span>Total</span>
          <strong>{formatMoney(total)}</strong>
        </div>
      )}
    </div>
  )
}
