// Venda rápida presencial (barraca): escolhe produtos, forma de pagamento
// e finaliza. Gera um pedido do canal "presencial", já pago (e retirado,
// se entregue na hora), com baixa de estoque — mesma regra de preço da loja.
import { useState } from 'react'
import { Link } from 'react-router'
import { PAYMENT_METHODS } from '../../../constants/orders'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { quickSale, getStaffCatalog } from '../../../services/salesService'
import { availableUnits, hasRealVariants, productImageUrl } from '../../../services/shopService'
import { cartKey } from '../../../utils/cart'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { formatMoney } from '../../../utils/money'
import { validatePhone, normalizePhone } from '../../../utils/validators'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { Checkbox } from '../../../components/common/Checkbox/Checkbox'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Icon } from '../../../components/common/Icon/Icon'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { OptionPicker } from '../../../components/shop/OptionPicker/OptionPicker'
import { QuantityStepper } from '../../../components/shop/QuantityStepper/QuantityStepper'
import shared from '../adminShared.module.css'
import styles from './QuickSale.module.css'

const EMPTY_FORM = { payment: 'pix', name: '', phone: '', delivered: true }

export default function QuickSale() {
  const toast = useToast()
  const canViewOrders = usePermission(PERMISSIONS.ORDERS_VIEW)
  const catalog = useAsync(getStaffCatalog, [])
  const [lines, setLines] = useState([])
  const [picking, setPicking] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [phoneError, setPhoneError] = useState('')
  const [saving, setSaving] = useState(false)
  const [last, setLast] = useState(null)
  const products = (catalog.data || []).filter((p) => p.lot)
  const total = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0)

  const addLine = (line) => {
    setLines((list) => {
      const existing = list.find((l) => l.key === line.key)
      if (existing) return list.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + line.quantity } : l))
      return [...list, line]
    })
    setPicking(null)
  }

  const finish = async () => {
    const err = form.phone ? validatePhone(form.phone) : ''
    setPhoneError(err)
    if (err || !lines.length) return
    setSaving(true)
    try {
      const sale = await quickSale({
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          variant_id: l.variant_id || undefined,
          parts: l.parts.length ? l.parts.map((p) => ({ product_id: p.product_id, variant_id: p.variant_id })) : undefined,
        })),
        paymentMethod: form.payment,
        customerName: form.name,
        customerPhone: form.phone ? normalizePhone(form.phone) : '',
        delivered: form.delivered,
      })
      setLast(sale)
      setLines([])
      setForm(EMPTY_FORM)
      toast.success(`Venda #${sale.number} registrada: ${formatMoney(sale.total)}`)
      catalog.reload()
    } catch (e) {
      toast.error(getErrorMessage(e, 'Não foi possível registrar a venda.'))
      catalog.reload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Venda rápida" description="Venda na barraca: baixa o estoque na hora, com o preço do lote vigente." />

      {last && (
        <p className={styles.last} role="status">
          <Icon name="check" size={18} />
          Última venda: {canViewOrders ? <Link to={ROUTES.ADMIN_ORDER(last.number)}>#{last.number}</Link> : `#${last.number}`} · {formatMoney(last.total)}
        </p>
      )}

      <div className={styles.layout}>
        <section aria-label="Produtos">
          {catalog.loading && <Skeleton height={260} />}
          {catalog.error && <ErrorState error={catalog.error} onRetry={catalog.reload} />}
          {!catalog.loading && !catalog.error && products.length === 0 && (
            <EmptyState icon="box" title="Nada à venda" description="Cadastre produtos com lote aberto e estoque em Produtos." />
          )}
          <div className={styles.grid}>
            {products.map((p) => {
              const units = availableUnits(p)
              return (
                <button key={p.id} type="button" className={styles.product} onClick={() => setPicking(p)} disabled={units <= 0}>
                  {p.images[0] ? (
                    <img src={productImageUrl(p.images[0].storage_path, { width: 240 })} alt="" loading="lazy" />
                  ) : (
                    <span className={styles.noImage}>
                      <Icon name="bag" />
                    </span>
                  )}
                  <span className={styles.productName}>{p.name}</span>
                  <span className={styles.productPrice}>{formatMoney(p.lot.price)}</span>
                  <span className={styles.productStock}>{units > 0 ? `${units} disp.` : 'Esgotado'}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className={cn(shared.card, styles.summary)} aria-labelledby="venda">
          <h2 id="venda" className={shared.cardTitle}>
            Venda atual
          </h2>
          {lines.length === 0 ? (
            <p className={shared.muted}>Toque nos produtos para adicionar.</p>
          ) : (
            <ul className={styles.lines}>
              {lines.map((l) => (
                <li key={l.key} className={styles.line}>
                  <div className={styles.lineMain}>
                    <strong>{l.name}</strong>
                    {l.detail && <span className={shared.muted}>{l.detail}</span>}
                    <span className={shared.muted}>{formatMoney(l.unit_price * l.quantity)}</span>
                  </div>
                  <QuantityStepper
                    value={l.quantity}
                    max={50}
                    onChange={(q) => setLines((list) => list.map((x) => (x.key === l.key ? { ...x, quantity: Math.max(1, q) } : x)))}
                  />
                  <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label={`Tirar ${l.name}`} onClick={() => setLines((list) => list.filter((x) => x.key !== l.key))} />
                </li>
              ))}
            </ul>
          )}
          <div className={styles.total}>
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Pagamento</span>
            <SegmentedControl
              label="Forma de pagamento"
              options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))}
              value={form.payment}
              onChange={(payment) => setForm((f) => ({ ...f, payment }))}
            />
          </div>
          <Input label="Nome do cliente (opcional)" value={form.name} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input
            label="Telefone (opcional)"
            type="tel"
            value={form.phone}
            error={phoneError}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Checkbox
            label="Entregue na hora"
            description="Desmarque se o cliente vai retirar depois (fica como Pago)."
            checked={form.delivered}
            onChange={(e) => setForm((f) => ({ ...f, delivered: e.target.checked }))}
          />
          <Button size="lg" icon="check" fullWidth loading={saving} disabled={!lines.length} onClick={finish}>
            Finalizar venda · {formatMoney(total)}
          </Button>
          <p className={shared.muted}>O valor final segue o lote vigente no momento da venda.</p>
        </section>
      </div>

      {picking && <PickModal product={picking} onClose={() => setPicking(null)} onAdd={addLine} />}
    </>
  )
}

// Escolha da variação (ou das variações do kit) e da quantidade
function PickModal({ product, onClose, onAdd }) {
  const isKit = product.kind === 'kit'
  const first = (variants, min = 1) => {
    const ok = (variants || []).filter((v) => v.stock >= min)
    return ok.length === 1 ? ok[0].id : ''
  }
  const [variantId, setVariantId] = useState(() => (isKit ? '' : first(product.variants)))
  const [parts, setParts] = useState(() => Object.fromEntries((product.kit_items || []).map((k) => [k.product_id, first(k.variants, k.quantity)])))
  const [quantity, setQuantity] = useState(1)
  const ready = isKit ? product.kit_items.every((k) => parts[k.product_id]) : Boolean(variantId)

  const add = () => {
    const variant = product.variants.find((v) => v.id === variantId)
    const kitParts = isKit
      ? product.kit_items.map((k) => {
          const v = k.variants.find((x) => x.id === parts[k.product_id])
          return { product_id: k.product_id, product_name: k.name, variant_id: v.id, variant_name: v.name }
        })
      : []
    const detail = isKit
      ? kitParts.map((p) => `${p.product_name}: ${p.variant_name}`).join(' · ')
      : variant && variant.name !== 'Único'
        ? variant.name
        : ''
    onAdd({
      key: cartKey(product.id, isKit ? '' : variantId, kitParts),
      product_id: product.id,
      name: product.name,
      variant_id: isKit ? null : variantId,
      parts: kitParts,
      detail,
      quantity,
      unit_price: Number(product.lot.price),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={product.name}
      description={`${product.lot.name}: ${formatMoney(product.lot.price)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon="plus" disabled={!ready} onClick={add}>
            Adicionar
          </Button>
        </>
      }
    >
      <div className={shared.stack}>
        {!isKit && hasRealVariants(product.variants) && (
          <OptionPicker label="Opção" options={product.variants} value={variantId} onChange={setVariantId} />
        )}
        {isKit &&
          product.kit_items.map((k) =>
            hasRealVariants(k.variants) ? (
              <OptionPicker
                key={k.product_id}
                label={`${k.quantity > 1 ? `${k.quantity}x ` : ''}${k.name}`}
                options={k.variants}
                minStock={k.quantity}
                value={parts[k.product_id]}
                onChange={(id) => setParts((p) => ({ ...p, [k.product_id]: id }))}
              />
            ) : (
              <p key={k.product_id}>Inclui: {k.name}</p>
            ),
          )}
        <div className={styles.qtyRow}>
          <span className={styles.fieldLabel}>Quantidade</span>
          <QuantityStepper value={quantity} onChange={(q) => setQuantity(Math.max(1, Math.min(50, q)))} max={50} />
        </div>
      </div>
    </Modal>
  )
}
