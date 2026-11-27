// Carrinho + finalizar pedido. Os preços mostrados são atualizados com o
// catálogo; o valor final é calculado pelo banco ao criar o pedido.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { useCart } from '../../../hooks/useCart'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useInteractionGuard } from '../../../hooks/useInteractionGuard'
import { useToast } from '../../../hooks/useToast'
import { createOrder } from '../../../services/ordersService'
import { getCatalog, getShopSettings, productImageUrl } from '../../../services/shopService'
import { getErrorMessage } from '../../../utils/errors'
import { formatMoney } from '../../../utils/money'
import { formatPhone, normalizePhone, validatePhone } from '../../../utils/validators'
import { Button } from '../../../components/common/Button/Button'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { Icon } from '../../../components/common/Icon/Icon'
import { Input } from '../../../components/common/Input/Input'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { QuantityStepper } from '../../../components/shop/QuantityStepper/QuantityStepper'
import shop from '../shop.module.css'
import styles from './Cart.module.css'

// Confere cada linha do carrinho com o catálogo atual
function checkItem(item, catalog) {
  const product = catalog.find((p) => p.id === item.product_id)
  if (!product) return { problem: 'Este produto não está mais à venda.' }
  if (!product.lot) return { product, problem: 'Fora de venda no momento (sem lote aberto).' }
  const lacks = []
  if (product.kind === 'kit') {
    for (const part of item.parts || []) {
      const k = product.kit_items.find((x) => x.product_id === part.product_id)
      const v = k?.variants.find((x) => x.id === part.variant_id)
      if (!v || v.stock < item.quantity * (k?.quantity || 1)) lacks.push(`${part.product_name}: ${part.variant_name}`)
    }
    if ((item.parts || []).length !== product.kit_items.length) return { product, problem: 'O kit mudou. Remova e escolha de novo.' }
  } else {
    const v = product.variants.find((x) => x.id === item.variant_id)
    if (!v) return { product, problem: 'Esta opção não está mais disponível.' }
    if (v.stock < item.quantity) return { product, problem: v.stock ? `Só restam ${v.stock}.` : 'Esgotado.' }
  }
  if (lacks.length) return { product, problem: `Sem estoque suficiente: ${lacks.join(', ')}.` }
  return { product, price: Number(product.lot.price) }
}

export default function Cart() {
  useDocumentTitle('Carrinho', { noindex: true })
  const cart = useCart()
  const { profile } = useAuth()
  const guard = useInteractionGuard()
  const toast = useToast()
  const navigate = useNavigate()
  const catalog = useAsync(getCatalog, [])
  const settings = useAsync(getShopSettings, [])
  // null = ainda não editado: usa o telefone do perfil (que pode chegar depois)
  const [phoneInput, setPhone] = useState(null)
  const phone = phoneInput ?? (formatPhone(profile?.phone) || '')
  const [notes, setNotes] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [sending, setSending] = useState(false)

  const rows = cart.items.map((item) => ({ item, ...(catalog.data ? checkItem(item, catalog.data) : {}) }))
  const hasProblem = rows.some((r) => r.problem)
  const estimate = rows.reduce((sum, r) => sum + (r.price ?? (Number(r.item.unit_price) || 0)) * r.item.quantity, 0)
  const isOpen = settings.data?.is_open !== false

  const submit = async (e) => {
    e.preventDefault()
    if (!guard('Entre na sua conta para fazer o pedido.')) return
    const err = validatePhone(phone)
    setPhoneError(err)
    if (err || hasProblem || !cart.items.length) return
    setSending(true)
    try {
      const order = await createOrder(
        cart.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          variant_id: i.variant_id || undefined,
          parts: i.parts?.length ? i.parts.map((p) => ({ product_id: p.product_id, variant_id: p.variant_id })) : undefined,
          holder_names: i.holder_names?.length ? i.holder_names : undefined,
        })),
        normalizePhone(phone),
        notes,
      )
      cart.clear()
      navigate(`${ROUTES.MY_ORDER(order.number)}?novo=1`, { replace: true })
    } catch (err2) {
      toast.error(getErrorMessage(err2, 'Não foi possível fazer o pedido.'))
      catalog.reload()
    } finally {
      setSending(false)
    }
  }

  if (!cart.items.length) {
    return (
      <div className={`container ${shop.page} ${shop.narrow}`}>
        <h1 className={shop.title}>Carrinho</h1>
        <EmptyState
          icon="cart"
          title="Seu carrinho está vazio"
          description="Escolha seu abadá, copo ou kit na loja."
          action={
            <Button to={ROUTES.SHOP} icon="bag">
              Ir para a loja
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className={`container ${shop.page} ${shop.narrow}`}>
      <h1 className={shop.title}>Carrinho</h1>

      <ul className={styles.list}>
        {rows.map(({ item, problem, price }) => (
          <li key={item.key} className={styles.item}>
            <Link to={ROUTES.PRODUCT(item.slug)} className={styles.thumb} tabIndex={-1} aria-hidden="true">
              {item.image ? <img src={productImageUrl(item.image, { width: 160 })} alt="" loading="lazy" /> : <Icon name="bag" />}
            </Link>
            <div className={styles.main}>
              <Link to={ROUTES.PRODUCT(item.slug)} className={styles.name}>
                {item.name}
              </Link>
              {item.variant_name && item.variant_name !== 'Único' && <span className={styles.detail}>{item.variant_name}</span>}
              {item.parts?.length > 0 && (
                <span className={styles.detail}>
                  {item.parts.map((p) => `${p.product_name}: ${p.variant_name}`).join(' · ')}
                </span>
              )}
              {item.ask_holder_name && (
                <details className={styles.names}>
                  <summary>Nomes de quem vai usar ({item.holder_names?.filter(Boolean).length || 0}/{item.quantity})</summary>
                  {Array.from({ length: item.quantity }, (_, i) => (
                    <Input
                      key={i}
                      label={`Unidade ${i + 1}`}
                      value={item.holder_names?.[i] || ''}
                      maxLength={80}
                      onChange={(e) => {
                        const list = [...(item.holder_names || [])]
                        list[i] = e.target.value
                        cart.setHolderNames(item.key, list)
                      }}
                    />
                  ))}
                </details>
              )}
              {problem && (
                <span className={styles.problem} role="alert">
                  <Icon name="alert" size={16} /> {problem}
                </span>
              )}
              <div className={styles.controls}>
                <QuantityStepper value={item.quantity} onChange={(q) => cart.setQuantity(item.key, q)} label={`Quantidade de ${item.name}`} />
                <Button variant="ghost" size="sm" icon="trash" onClick={() => cart.remove(item.key)}>
                  Remover
                </Button>
              </div>
            </div>
            <span className={styles.subtotal}>{formatMoney((price ?? item.unit_price) * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <section className={shop.card} aria-labelledby="finalizar">
        <h2 id="finalizar" className={shop.cardTitle}>
          Finalizar pedido
        </h2>
        <div className={styles.totalRow}>
          <span>Total estimado</span>
          <strong>{catalog.loading ? <Skeleton width={80} height={20} /> : formatMoney(estimate)}</strong>
        </div>
        <p className={shop.muted}>
          O valor é confirmado ao fazer o pedido (vale o preço do lote do momento). O pagamento é combinado com o bloco pelo WhatsApp e a retirada é
          presencial.
        </p>
        {settings.data?.pickup_info && (
          <p className={`${shop.muted} ${shop.pre}`}>
            <strong>Retirada:</strong> {settings.data.pickup_info}
          </p>
        )}

        {!isOpen ? (
          <p className={shop.notice} role="status">
            <Icon name="alert" size={18} /> A loja está fechada para novos pedidos no momento.
          </p>
        ) : (
          <form className={styles.form} onSubmit={submit} noValidate>
            <Input
              label="Seu WhatsApp"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={phoneError}
              hint="O bloco fala com você por este número."
              required
            />
            <Input as="textarea" label="Observação (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            {hasProblem && <p className={styles.problem}>Ajuste os itens marcados antes de continuar.</p>}
            <Button type="submit" size="lg" icon="check" fullWidth loading={sending} disabled={hasProblem || catalog.loading}>
              Fazer pedido
            </Button>
          </form>
        )}
      </section>

      <Button to={ROUTES.SHOP} variant="ghost" icon="arrowLeft" className={shop.back}>
        Continuar comprando
      </Button>
    </div>
  )
}
