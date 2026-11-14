// Categorias: criar, editar, ordenar (setas) e excluir
import { useState } from 'react'
import { PERMISSIONS } from '../../../constants/permissions'
import { useCategories } from '../../../hooks/useCategories'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
} from '../../../services/categoriesService'
import { getErrorMessage } from '../../../utils/errors'
import { slugify } from '../../../utils/slugify'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'
import styles from './Categories.module.css'

const EMPTY = { name: '', slug: '', description: '', color: '' }

export default function Categories() {
  const { categories, loading, error, reload, setCategories } = useCategories()
  const canCreate = usePermission(PERMISSIONS.CATEGORIES_CREATE)
  const canEdit = usePermission(PERMISSIONS.CATEGORIES_EDIT)
  const canDelete = usePermission(PERMISSIONS.CATEGORIES_DELETE)
  const toast = useToast()
  const [editing, setEditing] = useState(null) // null | 'new' | category
  const [toDelete, setToDelete] = useState(null)

  const move = async (index, dir) => {
    const list = [...categories]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    setCategories(list)
    try {
      await reorderCategories(list)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Não foi possível salvar a ordem.'))
      reload()
    }
  }

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Organize os posts. A ordem aqui é a ordem dos filtros na Home."
        actions={
          canCreate && (
            <Button icon="plus" onClick={() => setEditing('new')}>
              Nova categoria
            </Button>
          )
        }
      />

      {loading && <Skeleton height={200} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && categories.length === 0 && (
        <EmptyState icon="tag" title="Nenhuma categoria" description="Crie categorias como Ensaios, Desfile, Bastidores…" />
      )}

      {!loading && categories.length > 0 && (
        <ul className={shared.list}>
          {categories.map((c, i) => (
            <li key={c.id} className={shared.row}>
              <span className={styles.color} style={{ background: c.color || 'var(--color-surface-3)' }} aria-hidden="true" />
              <div className={shared.rowMain}>
                <span className={shared.rowTitle}>{c.name}</span>
                <span className={shared.rowMeta}>
                  /{c.slug}
                  {c.description && ` · ${c.description}`}
                </span>
              </div>
              <div className={shared.rowActions}>
                {canEdit && (
                  <>
                    <Button variant="ghost" size="sm" iconOnly icon="chevronUp" aria-label={`Subir ${c.name}`} onClick={() => move(i, -1)} disabled={i === 0} />
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon="chevronDown"
                      aria-label={`Descer ${c.name}`}
                      onClick={() => move(i, 1)}
                      disabled={i === categories.length - 1}
                    />
                    <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditing(c)}>
                      Editar
                    </Button>
                  </>
                )}
                {canDelete && (
                  <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label={`Excluir ${c.name}`} onClick={() => setToDelete(c)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

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
          await deleteCategory(toDelete.id)
          toast.success('Categoria excluída.')
          reload()
        }}
        title={`Excluir "${toDelete?.name}"?`}
        description="Os posts continuam existindo, apenas deixam de ter esta categoria."
        confirmLabel="Excluir"
      />
    </>
  )
}

function CategoryForm({ category, onClose, onSaved }) {
  const toast = useToast()
  const [values, setValues] = useState(category ? { ...EMPTY, ...category, color: category.color || '' } : EMPTY)
  const [slugTouched, setSlugTouched] = useState(Boolean(category))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const setName = (name) => setValues((v) => ({ ...v, name, slug: slugTouched ? v.slug : slugify(name, 60) }))

  const submit = async (e) => {
    e.preventDefault()
    const next = {
      name: values.name.trim().length < 2 ? 'Informe o nome (mínimo 2 letras).' : '',
      slug: !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(values.slug) ? 'Use letras minúsculas, números e hífens.' : '',
    }
    setErrors(next)
    if (next.name || next.slug) return
    setSaving(true)
    try {
      if (category) await updateCategory(category.id, values)
      else await createCategory(values)
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
          <Button type="submit" form="category-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="category-form" className={shared.stack} onSubmit={submit} noValidate>
        <Input label="Nome" value={values.name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={40} required data-autofocus />
        <Input
          label="Slug (endereço)"
          value={values.slug}
          onChange={(e) => {
            setSlugTouched(true)
            setValues((v) => ({ ...v, slug: slugify(e.target.value, 60) }))
          }}
          error={errors.slug}
          hint="Usado na URL do filtro: ?categoria=slug"
          required
        />
        <Input as="textarea" label="Descrição (opcional)" value={values.description || ''} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} maxLength={300} />
        <div className={styles.colorRow}>
          <Input
            label="Cor (opcional)"
            type="color"
            value={values.color || '#AB00B3'}
            onChange={(e) => setValues((v) => ({ ...v, color: e.target.value.toUpperCase() }))}
            className={styles.colorInput}
          />
          {values.color && (
            <Button variant="ghost" size="sm" onClick={() => setValues((v) => ({ ...v, color: '' }))}>
              Remover cor
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
