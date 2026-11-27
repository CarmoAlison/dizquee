// Compras de fornecedor: lista, itens, pago / a pagar e exclusão
import { useState } from 'react'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useToast } from '../../../hooks/useToast'
import { deletePurchase, listPurchases, setPurchasePayment } from '../../../services/stockService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { formatDateOnly as dateOnly } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/money'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Pagination } from '../../../components/common/Pagination/Pagination'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'
import styles from './Purchases.module.css'

const PAGE_SIZE = 25

export default function Purchases() {
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const { data, setData, loading, error, reload } = useAsync(() => listPurchases({ status, page, pageSize: PAGE_SIZE }), [status, page])
  const purchases = data?.purchases || []

  const togglePaid = async (p) => {
    const next = p.payment_status === 'paid' ? 'pending' : 'paid'
    try {
      await setPurchasePayment(p.id, next)
      toast.success(next === 'paid' ? 'Compra marcada como paga.' : 'Compra marcada como a pagar.')
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title="Compras"
        description="O que o bloco comprou de fornecedores. Cada compra soma ao estoque e registra o custo."
        actions={
          <Button icon="plus" to={ROUTES.ADMIN_PURCHASE_NEW}>
            Nova compra
          </Button>
        }
      />

      <div className={shared.toolbar}>
        <SegmentedControl
          label="Situação"
          options={[
            { value: '', label: 'Todas' },
            { value: 'pending', label: 'A pagar' },
            { value: 'paid', label: 'Pagas' },
          ]}
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(0)
          }}
        />
      </div>

      {loading && <Skeleton height={260} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && purchases.length === 0 && (
        <EmptyState
          icon="truck"
          title="Nenhuma compra registrada"
          description="Registre aqui os abadás e copos que chegam da confecção: o estoque e o custo são atualizados."
          action={
            <Button icon="plus" to={ROUTES.ADMIN_PURCHASE_NEW}>
              Nova compra
            </Button>
          }
        />
      )}

      {!loading && purchases.length > 0 && (
        <ul className={shared.list}>
          {purchases.map((p) => (
            <li key={p.id} className={cn(shared.row, styles.row)}>
              <div className={shared.rowMain}>
                <button type="button" className={styles.title} onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
                  {p.supplier_name} · {formatMoney(p.total)}
                </button>
                <span className={shared.rowMeta}>
                  {dateOnly(p.purchased_at)} · {p.purchase_items.reduce((s, i) => s + i.quantity, 0)} un.
                  {p.payment_status === 'pending' && p.due_date && ` · vence ${dateOnly(p.due_date)}`}
                  {p.payment_status === 'paid' && p.paid_at && ` · paga em ${dateOnly(p.paid_at)}`}
                </span>
              </div>
              <div className={shared.rowActions}>
                <span className={cn(shared.badge, p.payment_status === 'paid' ? shared.badgeSuccess : shared.badgeWarning)}>
                  {p.payment_status === 'paid' ? 'Paga' : 'A pagar'}
                </span>
                <Button size="sm" variant="secondary" onClick={() => togglePaid(p)}>
                  {p.payment_status === 'paid' ? 'Marcar a pagar' : 'Marcar paga'}
                </Button>
                <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label="Excluir compra" onClick={() => setToDelete(p)} />
              </div>
              {open === p.id && (
                <div className={styles.items}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col">Qtd.</th>
                        <th scope="col">Custo un.</th>
                        <th scope="col">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.purchase_items.map((i) => (
                        <tr key={i.id}>
                          <td>
                            {i.product_name} · {i.variant_name}
                          </td>
                          <td>{i.quantity}</td>
                          <td>{formatMoney(i.unit_cost)}</td>
                          <td>{formatMoney(i.unit_cost * i.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {p.notes && <p className={shared.muted}>Obs.: {p.notes}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onChange={setPage} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deletePurchase(toDelete.id)
          setData((d) => ({ ...d, purchases: d.purchases.filter((x) => x.id !== toDelete.id) }))
          toast.success('Compra excluída e estoque corrigido.')
        }}
        title={`Excluir a compra de ${toDelete?.supplier_name}?`}
        description="Os itens desta compra saem do estoque. Só é possível se eles ainda estiverem no estoque."
        confirmLabel="Excluir"
      />
    </>
  )
}
