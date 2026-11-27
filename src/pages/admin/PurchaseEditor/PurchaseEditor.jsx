// Nova compra de fornecedor: itens (variação, quantidade, custo), situação
// do pagamento. Ao salvar, o estoque sobe e o custo médio é recalculado.
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useToast } from '../../../hooks/useToast'
import { createPurchase, getStockOverview, listSuppliers } from '../../../services/stockService'
import { getErrorMessage } from '../../../utils/errors'
import { todayInput } from '../../../utils/formatDate'
import { formatMoney, parseMoney } from '../../../utils/money'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'
import styles from './PurchaseEditor.module.css'

const newLine = () => ({ id: crypto.randomUUID(), variant_id: '', quantity: '', unit_cost: '' })

export default function PurchaseEditor() {
  const navigate = useNavigate()
  const toast = useToast()
  const variants = useAsync(getStockOverview, [])
  const suppliers = useAsync(listSuppliers, [])
  const [supplier, setSupplier] = useState('')
  const [date, setDate] = useState(todayInput)
  const [lines, setLines] = useState([newLine()])
  const [paymentStatus, setPaymentStatus] = useState('pending')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const setLine = (id, key, value) => setLines((list) => list.map((l) => (l.id === id ? { ...l, [key]: value } : l)))
  const parsed = lines.map((l) => ({ ...l, qty: Math.floor(Number(l.quantity) || 0), cost: parseMoney(l.unit_cost) }))
  const total = parsed.reduce((s, l) => s + (l.qty > 0 && l.cost !== null ? l.qty * l.cost : 0), 0)

  const submit = async (e) => {
    e.preventDefault()
    const filled = parsed.filter((l) => l.variant_id || l.quantity || l.unit_cost)
    const next = {
      supplier: supplier.trim().length < 2 ? 'Informe o fornecedor.' : '',
      lines: !filled.length
        ? 'Adicione pelo menos um item.'
        : filled.some((l) => !l.variant_id || l.qty < 1 || l.cost === null || l.cost < 0)
          ? 'Confira os itens: variação, quantidade e custo unitário são obrigatórios.'
          : '',
    }
    setErrors(next)
    if (next.supplier || next.lines) return
    setSaving(true)
    try {
      await createPurchase({
        supplierName: supplier,
        items: filled.map((l) => ({ variant_id: l.variant_id, quantity: l.qty, unit_cost: l.cost })),
        purchasedAt: date,
        paymentStatus,
        dueDate: paymentStatus === 'pending' ? dueDate : null,
        notes,
      })
      toast.success('Compra registrada e estoque atualizado!')
      navigate(ROUTES.ADMIN_PURCHASES)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Nova compra"
        description="Ex.: 300 abadás da confecção. Cada item soma ao estoque da variação."
        actions={
          <Button variant="ghost" icon="arrowLeft" to={ROUTES.ADMIN_PURCHASES}>
            Compras
          </Button>
        }
      />

      {variants.error && <ErrorState error={variants.error} onRetry={variants.reload} />}

      <form className={shared.stack} onSubmit={submit} noValidate>
        <section className={shared.card}>
          <div className={shared.formGrid}>
            <Input
              label="Fornecedor"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              list="suppliers-list"
              error={errors.supplier}
              maxLength={80}
              required
              hint="Escolha um da lista ou digite um novo."
            />
            <datalist id="suppliers-list">
              {(suppliers.data || []).map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            <Input label="Data da compra" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </section>

        <section className={shared.card}>
          <h2 className={shared.cardTitle}>Itens</h2>
          {variants.loading ? (
            <Skeleton height={120} />
          ) : (
            <ul className={styles.lines}>
              {parsed.map((l, i) => (
                <li key={l.id} className={styles.line}>
                  <Input
                    as="select"
                    label="Produto e variação"
                    hideLabel={i > 0}
                    value={l.variant_id}
                    onChange={(e) => setLine(l.id, 'variant_id', e.target.value)}
                    className={styles.variant}
                  >
                    <option value="">Escolha…</option>
                    {(variants.data || []).map((v) => (
                      <option key={v.variant_id} value={v.variant_id}>
                        {v.product_name} · {v.variant_name} (estoque {v.stock})
                      </option>
                    ))}
                  </Input>
                  <Input
                    label="Quantidade"
                    hideLabel={i > 0}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={l.quantity}
                    onChange={(e) => setLine(l.id, 'quantity', e.target.value)}
                    className={styles.small}
                  />
                  <Input
                    label="Custo unitário"
                    hideLabel={i > 0}
                    prefix="R$"
                    inputMode="decimal"
                    placeholder="25,00"
                    value={l.unit_cost}
                    onChange={(e) => setLine(l.id, 'unit_cost', e.target.value)}
                    className={styles.small}
                  />
                  <span className={styles.subtotal}>{l.qty > 0 && l.cost !== null ? formatMoney(l.qty * l.cost) : '—'}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon="trash"
                    aria-label="Remover item"
                    disabled={lines.length === 1}
                    onClick={() => setLines((list) => list.filter((x) => x.id !== l.id))}
                  />
                </li>
              ))}
            </ul>
          )}
          {errors.lines && (
            <p className={styles.error} role="alert">
              {errors.lines}
            </p>
          )}
          <div className={styles.footer}>
            <Button variant="secondary" icon="plus" onClick={() => setLines((list) => [...list, newLine()])}>
              Adicionar item
            </Button>
            <p className={styles.total}>
              Total: <strong>{formatMoney(total)}</strong>
            </p>
          </div>
        </section>

        <section className={shared.card}>
          <h2 className={shared.cardTitle}>Pagamento ao fornecedor</h2>
          <div className={shared.stack}>
            <SegmentedControl
              label="Situação do pagamento"
              options={[
                { value: 'pending', label: 'A pagar' },
                { value: 'paid', label: 'Já paga' },
              ]}
              value={paymentStatus}
              onChange={setPaymentStatus}
            />
            {paymentStatus === 'pending' && (
              <Input label="Vencimento (opcional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            )}
            <Input as="textarea" label="Observação (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} hint="Nº da nota, forma de pagamento combinada…" />
            <p className={shared.muted}>Na fase do financeiro, a compra entra automaticamente como despesa (a pagar ou paga).</p>
          </div>
        </section>

        <div>
          <Button type="submit" size="lg" icon="check" loading={saving}>
            Registrar compra · {formatMoney(total)}
          </Button>
        </div>
      </form>
    </>
  )
}
