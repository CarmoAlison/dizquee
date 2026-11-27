// Lançamentos financeiros: lista com filtros, novo/editar (manuais),
// marcar como pago/recebido e excluir. Automáticos mostram a origem.
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ENTRY_SOURCES, ENTRY_TYPES, FINANCE_PAYMENT_METHODS, statusLabel } from '../../../constants/finance'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useDebounce } from '../../../hooks/useDebounce'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { createEntry, deleteEntry, listEntries, listFinanceCategories, setEntryStatus, updateEntry } from '../../../services/financeService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { formatDateOnly, todayInput } from '../../../utils/formatDate'
import { formatMoney, moneyInput, parseMoney } from '../../../utils/money'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { Checkbox } from '../../../components/common/Checkbox/Checkbox'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { Pagination } from '../../../components/common/Pagination/Pagination'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'
import styles from './FinanceEntries.module.css'

const PAGE_SIZE = 30
const today = () => todayInput()

export default function FinanceEntries() {
  const toast = useToast()
  const canManage = usePermission(PERMISSIONS.FINANCE_MANAGE)
  const canViewOrders = usePermission(PERMISSIONS.ORDERS_VIEW)
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState(() => ({
    type: '',
    status: '',
    categoryId: '',
    source: '',
    from: '',
    to: '',
    search: '',
    overdue: params.get('vencidos') === '1',
  }))
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(() => (params.get('novo') === '1' ? 'new' : null))
  const [toDelete, setToDelete] = useState(null)
  const search = useDebounce(filters.search, 400)
  const categories = useAsync(listFinanceCategories, [])
  const list = useAsync(
    () => listEntries({ ...filters, search, page, pageSize: PAGE_SIZE }),
    [filters.type, filters.status, filters.categoryId, filters.source, filters.from, filters.to, filters.overdue, search, page],
  )
  const entries = list.data?.entries || []
  const set = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(0)
  }
  const pageTotal = entries.reduce((s, e) => s + (e.type === 'income' ? 1 : -1) * Number(e.amount), 0)

  const toggleStatus = async (e) => {
    try {
      await setEntryStatus(e.id, e.status === 'paid' ? 'pending' : 'paid')
      list.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const closeEditor = () => {
    setEditing(null)
    if (params.get('novo')) setParams({}, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Lançamentos"
        description="Receitas e despesas do bloco: patrocínio, banda, trio, segurança… As vendas e compras entram sozinhas."
        actions={
          canManage && (
            <Button icon="plus" onClick={() => setEditing('new')}>
              Novo lançamento
            </Button>
          )
        }
      />

      <div className={shared.toolbar}>
        <Input label="Buscar" type="search" placeholder="Descrição ou observação" value={filters.search} onChange={(e) => set('search')(e.target.value)} />
        <Input as="select" label="Tipo" value={filters.type} onChange={(e) => set('type')(e.target.value)}>
          <option value="">Receitas e despesas</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </Input>
        <Input as="select" label="Situação" value={filters.status} onChange={(e) => set('status')(e.target.value)} disabled={filters.overdue}>
          <option value="">Todas</option>
          <option value="paid">Pago / recebido</option>
          <option value="pending">A pagar / a receber</option>
        </Input>
        <Input as="select" label="Categoria" value={filters.categoryId} onChange={(e) => set('categoryId')(e.target.value)}>
          <option value="">Todas</option>
          {(categories.data || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({ENTRY_TYPES[c.type].label})
            </option>
          ))}
        </Input>
        <Input as="select" label="Origem" value={filters.source} onChange={(e) => set('source')(e.target.value)}>
          <option value="">Todas</option>
          {Object.entries(ENTRY_SOURCES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Input>
        <Input label="De" type="date" value={filters.from} onChange={(e) => set('from')(e.target.value)} disabled={filters.overdue} />
        <Input label="Até" type="date" value={filters.to} onChange={(e) => set('to')(e.target.value)} disabled={filters.overdue} />
        <Checkbox label="Só vencidos" checked={filters.overdue} onChange={(e) => set('overdue')(e.target.checked)} />
      </div>

      {list.loading && <Skeleton height={300} />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && entries.length === 0 && (
        <EmptyState icon="list" title="Nenhum lançamento" description="Ajuste os filtros ou lance uma receita/despesa." />
      )}

      {!list.loading && entries.length > 0 && (
        <>
          <ul className={shared.list}>
            {entries.map((e) => {
              const overdue = e.status === 'pending' && e.due_date < today()
              return (
                <li key={e.id} className={cn(shared.row, overdue && styles.overdueRow)}>
                  <span
                    className={styles.dot}
                    style={{ background: e.finance_categories?.color || (e.type === 'income' ? 'var(--color-success)' : 'var(--color-accent-1-strong)') }}
                    aria-hidden="true"
                  />
                  <div className={shared.rowMain}>
                    <span className={shared.rowTitle}>{e.description}</span>
                    <span className={shared.rowMeta}>
                      {formatDateOnly(e.ref_date)} · {e.finance_categories?.name}
                      {e.payment_method && ` · ${FINANCE_PAYMENT_METHODS[e.payment_method]}`}
                      {e.status === 'pending' && ` · vence ${formatDateOnly(e.due_date)}`}
                    </span>
                    {(e.source !== 'manual' || e.notes) && (
                      <span className={shared.rowMeta}>
                        {e.source !== 'manual' && (
                          <>
                            Automático: {ENTRY_SOURCES[e.source]}
                            {e.orders?.number && canViewOrders && (
                              <>
                                {' '}
                                · <Link to={ROUTES.ADMIN_ORDER(e.orders.number)}>ver pedido #{e.orders.number}</Link>
                              </>
                            )}
                            {e.source === 'purchase' && (
                              <>
                                {' '}
                                · <Link to={ROUTES.ADMIN_PURCHASES}>ver compras</Link>
                              </>
                            )}
                          </>
                        )}
                        {e.notes && `${e.source !== 'manual' ? ' · ' : ''}${e.notes}`}
                      </span>
                    )}
                  </div>
                  <div className={shared.rowActions}>
                    <strong className={cn(styles.amount, e.type === 'income' ? styles.income : styles.expense)}>
                      {e.type === 'income' ? '+' : '−'} {formatMoney(e.amount)}
                    </strong>
                    <span className={cn(shared.badge, e.status === 'paid' ? shared.badgeSuccess : overdue ? shared.badgeDanger : shared.badgeWarning)}>
                      {overdue ? 'Vencido' : statusLabel(e.type, e.status)}
                    </span>
                    {canManage && ['manual', 'purchase'].includes(e.source) && (
                      <Button size="sm" variant="secondary" onClick={() => toggleStatus(e)}>
                        {e.status === 'paid' ? 'Desfazer pagamento' : e.type === 'income' ? 'Recebido' : 'Pago'}
                      </Button>
                    )}
                    {canManage && e.source === 'manual' && (
                      <>
                        <Button size="sm" variant="ghost" iconOnly icon="edit" aria-label="Editar" onClick={() => setEditing(e)} />
                        <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label="Excluir" onClick={() => setToDelete(e)} />
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className={cn(shared.muted, styles.pageTotal)}>
            Saldo dos lançamentos desta página: <strong>{formatMoney(pageTotal)}</strong>
          </p>
        </>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={list.data?.total || 0} onChange={setPage} />

      {editing && canManage && (
        <EntryForm
          entry={editing === 'new' ? null : editing}
          categories={categories.data || []}
          onClose={closeEditor}
          onSaved={() => {
            closeEditor()
            list.reload()
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteEntry(toDelete.id)
          toast.success('Lançamento excluído.')
          list.reload()
        }}
        title={`Excluir "${toDelete?.description}"?`}
        confirmLabel="Excluir"
      />
    </>
  )
}

function EntryForm({ entry, categories, onClose, onSaved }) {
  const toast = useToast()
  const [values, setValues] = useState(() => ({
    type: entry?.type || 'expense',
    category_id: entry?.category_id || '',
    description: entry?.description || '',
    amount: moneyInput(entry?.amount),
    status: entry?.status || 'paid',
    paid_at: entry?.paid_at || today(),
    due_date: entry?.due_date || today(),
    payment_method: entry?.payment_method || '',
    notes: entry?.notes || '',
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }))
  const options = categories.filter((c) => c.type === values.type)

  const submit = async (e) => {
    e.preventDefault()
    const amount = parseMoney(values.amount)
    const next = {
      description: values.description.trim().length < 2 ? 'Descreva o lançamento.' : '',
      category_id: !values.category_id ? 'Escolha a categoria.' : '',
      amount: !amount || amount <= 0 ? 'Informe o valor. Ex.: 1500,00' : '',
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    setSaving(true)
    try {
      const data = { ...values, amount }
      if (entry) await updateEntry(entry.id, data)
      else await createEntry(data)
      toast.success('Lançamento salvo!')
      onSaved()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const isIncome = values.type === 'income'

  return (
    <Modal
      open
      onClose={onClose}
      title={entry ? 'Editar lançamento' : 'Novo lançamento'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="entry-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="entry-form" className={shared.stack} onSubmit={submit} noValidate>
        <SegmentedControl
          label="Tipo"
          options={[
            { value: 'expense', label: 'Despesa' },
            { value: 'income', label: 'Receita' },
          ]}
          value={values.type}
          onChange={(type) => setValues((v) => ({ ...v, type, category_id: '' }))}
        />
        <Input
          label="Descrição"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          error={errors.description}
          maxLength={200}
          placeholder={isIncome ? 'Ex.: Patrocínio da cervejaria' : 'Ex.: Cachê da banda (sinal)'}
          required
          data-autofocus
        />
        <div className={shared.formGrid}>
          <Input as="select" label="Categoria" value={values.category_id} onChange={(e) => set('category_id', e.target.value)} error={errors.category_id} required>
            <option value="">Escolha…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Input>
          <Input label="Valor" prefix="R$" inputMode="decimal" placeholder="1.500,00" value={values.amount} onChange={(e) => set('amount', e.target.value)} error={errors.amount} required />
        </div>
        <SegmentedControl
          label="Situação"
          options={[
            { value: 'paid', label: isIncome ? 'Recebido' : 'Pago' },
            { value: 'pending', label: isIncome ? 'A receber' : 'A pagar' },
          ]}
          value={values.status}
          onChange={(status) => set('status', status)}
        />
        <div className={shared.formGrid}>
          {values.status === 'paid' ? (
            <Input label={isIncome ? 'Recebido em' : 'Pago em'} type="date" value={values.paid_at} onChange={(e) => set('paid_at', e.target.value)} />
          ) : (
            <Input label="Vencimento" type="date" value={values.due_date} onChange={(e) => set('due_date', e.target.value)} />
          )}
          <Input as="select" label="Forma de pagamento" value={values.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
            <option value="">—</option>
            {Object.entries(FINANCE_PAYMENT_METHODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Input>
        </div>
        <Input as="textarea" label="Observação (opcional)" value={values.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} />
      </form>
    </Modal>
  )
}
