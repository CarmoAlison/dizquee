// Página do produto: fotos, preço do lote, escolha de variação (ou das
// variações de cada item do kit), quantidade, nomes e "Adicionar ao carrinho".
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useCart } from '../../../hooks/useCart'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useInteractionGuard } from '../../../hooks/useInteractionGuard'
import { useToast } from '../../../hooks/useToast'
import { getProductBySlug, hasRealVariants, productImageUrl, saleState } from '../../../services/shopService'
import { MAX_ITEM_QUANTITY, cartKey } from '../../../utils/cart'
import { formatDateTime } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/money'
import { Button } from '../../../components/common/Button/Button'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { OptionPicker } from '../../../components/shop/OptionPicker/OptionPicker'
import { ProductGallery } from '../../../components/shop/ProductGallery/ProductGallery'
import { QuantityStepper } from '../../../components/shop/QuantityStepper/QuantityStepper'
import shop from '../shop.module.css'
import styles from './ProductDetails.module.css'

export default function ProductDetails() {
  const { slug } = useParams()
  const { data: product, loading, error, reload } = useAsync(() => getProductBySlug(slug), [slug])

  useDocumentTitle(product?.name || 'Loja', {
    description: product?.description?.slice(0, 160),
    image: product?.images?.[0] ? productImageUrl(product.images[0].storage_path) : undefined,
  })

  if (loading) {
    return (
      <div className={`container ${shop.page}`}>
        <div className={styles.layout}>
          <Skeleton height={360} />
          <Skeleton height={360} />
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className={`container ${shop.page}`}>
        <ErrorState error={error} onRetry={reload} />
      </div>
    )
  }
  if (!product) {
    return (
      <div className={`container ${shop.page}`}>
        <EmptyState
          icon="bag"
          title="Produto não encontrado"
          description="Ele pode ter saído da loja."
          action={
            <Button to={ROUTES.SHOP} variant="secondary">
              Ver a loja
            </Button>
          }
        />
      </div>
    )
  }
  return <ProductContent key={product.id} product={product} />
}

// Variação única com estoque: já vem escolhida
function autoPick(variants, minStock = 1) {
  const available = (variants || []).filter((v) => v.stock >= minStock)
  return available.length === 1 && (variants.length === 1 || !hasRealVariants(variants)) ? available[0].id : ''
}

function ProductContent({ product }) {
  const cart = useCart()
  const guard = useInteractionGuard()
  const toast = useToast()
  const isKit = product.kind === 'kit'
  const state = saleState(product)

  const [variantId, setVariantId] = useState(() => (isKit ? '' : autoPick(product.variants)))
  const [parts, setParts] = useState(() =>
    Object.fromEntries((product.kit_items || []).map((k) => [k.product_id, autoPick(k.variants, k.quantity)])),
  )
  const [quantity, setQuantity] = useState(1)
  const [names, setNames] = useState([])
  const [errors, setErrors] = useState({})
  const [added, setAdded] = useState(false)

  // Máximo pela escolha atual (estoque); o lote pode virar no meio, o banco divide
  const maxQuantity = useMemo(() => {
    let max = MAX_ITEM_QUANTITY
    if (isKit) {
      for (const k of product.kit_items || []) {
        const v = k.variants.find((x) => x.id === parts[k.product_id])
        if (v) max = Math.min(max, Math.floor(v.stock / k.quantity))
      }
    } else {
      const v = product.variants.find((x) => x.id === variantId)
      if (v) max = Math.min(max, v.stock)
    }
    return Math.max(1, max)
  }, [isKit, product, parts, variantId])

  const qty = Math.min(quantity, maxQuantity)

  const addToCart = () => {
    if (!guard('Entre na sua conta para comprar.')) return
    const next = {}
    if (!isKit && !variantId) next.variant = 'Escolha uma opção.'
    if (isKit) {
      for (const k of product.kit_items) if (!parts[k.product_id]) next[k.product_id] = `Escolha a opção de ${k.name}.`
    }
    setErrors(next)
    if (Object.keys(next).length) return

    const variant = product.variants.find((v) => v.id === variantId)
    const kitParts = isKit
      ? product.kit_items.map((k) => {
          const v = k.variants.find((x) => x.id === parts[k.product_id])
          return { product_id: k.product_id, product_name: k.name, variant_id: v.id, variant_name: v.name, quantity: k.quantity }
        })
      : []
    cart.add({
      key: cartKey(product.id, isKit ? '' : variantId, kitParts),
      product_id: product.id,
      slug: product.slug,
      name: product.name,
      kind: product.kind,
      image: product.images?.[0]?.storage_path || null,
      ask_holder_name: product.ask_holder_name,
      variant_id: isKit ? null : variantId,
      variant_name: isKit ? null : variant?.name,
      parts: kitParts,
      quantity: qty,
      holder_names: product.ask_holder_name ? names.slice(0, qty).map((n) => n.trim()).filter(Boolean) : [],
      unit_price: product.lot?.price ?? 0,
    })
    setAdded(true)
    setNames([])
    toast.success('Adicionado ao carrinho!')
  }

  return (
    <div className={`container ${shop.page}`}>
      <Button to={ROUTES.SHOP} variant="ghost" size="sm" icon="arrowLeft" className={shop.back}>
        Loja
      </Button>

      <div className={styles.layout}>
        <ProductGallery images={product.images} name={product.name} />

        <div className={styles.info}>
          <div className={styles.headline}>
            {isKit && <span className={styles.kitTag}>Kit</span>}
            <h1 className={styles.name}>{product.name}</h1>
            {product.lot ? (
              <div className={styles.priceRow}>
                <span className={styles.price}>{formatMoney(product.lot.price)}</span>
                <span className={styles.lot}>{product.lot.name}</span>
              </div>
            ) : (
              product.next_lot && (
                <div className={styles.priceRow}>
                  <span className={styles.price}>{formatMoney(product.next_lot.price)}</span>
                  <span className={styles.lot}>{product.next_lot.name}</span>
                </div>
              )
            )}
            {product.lot && (product.lot.remaining !== null || product.lot.ends_at) && (
              <p className={shop.muted}>
                {product.lot.remaining !== null && `Restam ${product.lot.remaining} neste lote. `}
                {product.lot.ends_at && `Lote válido até ${formatDateTime(product.lot.ends_at)}.`}
              </p>
            )}
            {product.lot && product.next_lot && (
              <p className={shop.muted}>
                Depois: {product.next_lot.name} por {formatMoney(product.next_lot.price)}.
              </p>
            )}
          </div>

          {state === 'soldout' && <p className={shop.notice}>Esgotado no momento.</p>}
          {state === 'soon' && (
            <p className={shop.notice}>
              Vendas em breve
              {product.next_lot?.starts_at && `: a partir de ${formatDateTime(product.next_lot.starts_at)}`}.
            </p>
          )}

          {state === 'available' && (
            <div className={styles.form}>
              {!isKit && hasRealVariants(product.variants) && (
                <OptionPicker
                  label="Opção"
                  options={product.variants}
                  value={variantId}
                  onChange={(id) => {
                    setVariantId(id)
                    setErrors({})
                  }}
                  error={errors.variant}
                />
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
                      onChange={(id) => {
                        setParts((p) => ({ ...p, [k.product_id]: id }))
                        setErrors({})
                      }}
                      error={errors[k.product_id]}
                    />
                  ) : (
                    <p key={k.product_id} className={styles.kitLine}>
                      Inclui: {k.quantity > 1 ? `${k.quantity}x ` : ''}
                      {k.name}
                      {errors[k.product_id] && <span className={styles.error}> (esgotado)</span>}
                    </p>
                  ),
                )}

              <div className={styles.qtyRow}>
                <span className={styles.qtyLabel}>Quantidade</span>
                <QuantityStepper value={qty} onChange={setQuantity} max={maxQuantity} />
              </div>

              {product.ask_holder_name && (
                <div className={styles.names}>
                  <p className={styles.qtyLabel}>Nome de quem vai usar (opcional)</p>
                  {Array.from({ length: qty }, (_, i) => (
                    <Input
                      key={i}
                      label={qty > 1 ? `Unidade ${i + 1}` : 'Nome'}
                      hideLabel={qty === 1}
                      placeholder="Ex.: Maria Silva"
                      value={names[i] || ''}
                      maxLength={80}
                      onChange={(e) =>
                        setNames((list) => {
                          const copy = [...list]
                          copy[i] = e.target.value
                          return copy
                        })
                      }
                    />
                  ))}
                </div>
              )}

              <Button icon="cart" size="lg" fullWidth onClick={addToCart}>
                Adicionar ao carrinho · {formatMoney((product.lot?.price || 0) * qty)}
              </Button>
              {added && (
                <Button to={ROUTES.CART} variant="secondary" fullWidth iconRight="chevronRight">
                  Ver carrinho ({cart.count})
                </Button>
              )}
            </div>
          )}

          {product.description && <p className={`${styles.description} ${shop.pre}`}>{product.description}</p>}
        </div>
      </div>
    </div>
  )
}
