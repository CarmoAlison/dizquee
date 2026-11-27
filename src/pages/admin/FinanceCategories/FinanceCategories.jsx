// Categorias financeiras (finance.manage). As de sistema (vendas, compras,
// reembolsos) recebem os lançamentos automáticos e não podem ser excluídas.
import { useState } from 'react'
import { ENTRY_TYPES } from '../../../constants/finance'
import { useAsync } from '../../../hooks/useAsync'
import { useToast } from '../../../hooks/useToast'
import { deleteFinanceCategory, listFinanceCategories, saveFinanceCategory } from '../../../services/financeService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'

export default function FinanceCategories() {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(listFinanceCategories, [])
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  return (
    <>
      <PageHeader
        title="Categorias financeiras"
        description="Organize receitas e despesas (ex.: Patrocínio, Banda, Trio, Segurança)."
        actions={
          <Button icon="plus" onClick={() => setEditing('new')}>
            Nova categoria
          </Button>
        }
      />
      {loading && <Skeleton height={240} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data &&
        ['income', 'expense'].map((type) => (
          <section key={type} className={shared.card} style={{ marginBottom: 'var(--space-4)' }}>
            <h2 className={shared.cardTitle}>{ENTRY_TYPES[type].plural}</h2>
            <ul className={shared.list}>
              {data
                .filter((c) => c.type === type)
                .map((c) => (
                  <li key={c.id} className={shared.row}>
                    <span
                      aria-hidden="true"
                      style={{ width: 14, height: 32, borderRadius: 7, flexShrink: 0, background: c.color || 'var(--color-surface-3)' }}
                    />
                    <div className={shared.rowMain}>
                      <span className={shared.rowTitle}>{c.name}</span>
                      {c.system_key && <span className={shared.rowMeta}>Recebe os lançamentos automáticos</span>}
                    </div>
                    <div className={shared.rowActions}>
                      {c.system_key && <span className={cn(shared.badge, shared.badgeAccent)}>Sistema</span>}
                      <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(c)}>
                        Editar
                      </Button>
                      {!c.system_key && (
                        <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Excluir ${c.name}`} onClick={() => setToDelete(c)} />
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}

      {editing && (
        <CategoryForm
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteFinanceCategory(toDelete.id)
          toast.success('Categoria excluída.')
          reload()
        }}
        title={`Excluir "${toDelete?.name}"?`}
        description="Só é possível se não houver lançamentos nela."
        confirmLabel="Excluir"
      />
    </>
  )
}

function CategoryForm({ category, onClose, onSaved }) {
  const toast = useToast()
  const [name, setName] = useState(category?.name || '')
  const [type, setType] = useState(category?.type || 'expense')
  const [color, setColor] = useState(category?.color || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (name.trim().length < 2) {
      setError('Informe o nome.')
      return
    }
    setSaving(true)
    try {
      await saveFinanceCategory(category?.id, { name, type, color })
      toast.success('Categoria salva!')
      onSaved()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? 'Editar categoria' : 'Nova categoria'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="fin-cat-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="fin-cat-form" className={shared.stack} onSubmit={submit} noValidate>
        {!category?.system_key && (
          <SegmentedControl
            label="Tipo"
            options={[
              { value: 'expense', label: 'Despesa' },
              { value: 'income', label: 'Receita' },
            ]}
            value={type}
            onChange={setType}
          />
        )}
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} error={error} maxLength={60} required data-autofocus />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
          <Input label="Cor (opcional)" type="color" value={color || '#AB00B3'} onChange={(e) => setColor(e.target.value.toUpperCase())} style={{ width: 120 }} />
          {color && (
            <Button variant="ghost" size="sm" onClick={() => setColor('')}>
              Sem cor
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
