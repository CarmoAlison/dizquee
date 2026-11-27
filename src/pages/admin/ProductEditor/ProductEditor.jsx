// Cadastro do produto: dados, fotos, variações com estoque (ou itens do
// kit) e lotes de preço. Um produto novo é criado primeiro com os dados
// básicos; as demais seções aparecem logo em seguida.
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useToast } from '../../../hooks/useToast'
import {
  addKitItem,
  createLot,
  createProduct,
  createVariant,
  currentLot,
  deleteLot,
  deleteProduct,
  deleteProductImage,
  deleteVariant,
  getProduct,
  listSimpleProducts,
  removeKitItem,
  reorderImages,
  reorderLots,
  updateKitItem,
  updateLot,
  updateProduct,
  updateVariant,
  uploadProductImage,
} from '../../../services/productsAdminService'
import { productImageUrl } from '../../../services/shopService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { formatDateTime, fromDateTimeLocal, toDateTimeLocal } from '../../../utils/formatDate'
import { formatMoney, moneyInput, parseMoney } from '../../../utils/money'
import { slugify } from '../../../utils/slugify'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { Checkbox } from '../../../components/common/Checkbox/Checkbox'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Icon } from '../../../components/common/Icon/Icon'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { ProgressBar } from '../../../components/common/ProgressBar/ProgressBar'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'
import styles from './ProductEditor.module.css'

const MAX_IMAGES = 8

export default function ProductEditor() {
  const { id } = useParams()
  return id ? <EditProduct key={id} id={id} /> : <NewProduct />
}

function NewProduct() {
  const navigate = useNavigate()
  const toast = useToast()
  return (
    <>
      <PageHeader
        title="Novo produto"
        description="Comece pelos dados básicos. Depois você adiciona fotos, variações, estoque e lotes."
        actions={
          <Button variant="ghost" icon="arrowLeft" to={ROUTES.ADMIN_PRODUCTS}>
            Produtos
          </Button>
        }
      />
      <section className={shared.card}>
        <ProductInfoForm
          isNew
          onSaved={(p) => {
            toast.success('Produto criado! Agora adicione fotos, variações e lotes.')
            navigate(ROUTES.ADMIN_PRODUCT_EDIT(p.id), { replace: true })
          }}
        />
      </section>
    </>
  )
}

function EditProduct({ id }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: product, setData, loading, error, reload } = useAsync(() => getProduct(id), [id])
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (loading && !product) return <Skeleton height={400} />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!product) {
    return (
      <EmptyState
        icon="box"
        title="Produto não encontrado"
        action={
          <Button to={ROUTES.ADMIN_PRODUCTS} variant="secondary">
            Voltar aos produtos
          </Button>
        }
      />
    )
  }

  const isKit = product.kind === 'kit'
  const missing = []
  if (!product.product_lots.length) missing.push('um lote com preço')
  if (isKit && !product.kit_items.length) missing.push('os itens do kit')
  if (!isKit && !product.product_variants.some((v) => v.is_active && v.stock > 0)) missing.push('estoque')

  return (
    <>
      <PageHeader
        title={product.name}
        description={isKit ? 'Kit: o estoque vem dos produtos que compõem o kit.' : 'Produto simples com variações e estoque próprio.'}
        actions={
          <>
            <Button variant="ghost" icon="arrowLeft" to={ROUTES.ADMIN_PRODUCTS}>
              Produtos
            </Button>
            {product.is_active && (
              <Button variant="secondary" icon="external" href={ROUTES.PRODUCT(product.slug)} target="_blank" rel="noopener noreferrer">
                Ver na loja
              </Button>
            )}
          </>
        }
      />

      {missing.length > 0 && (
        <p className={styles.warning} role="status">
          <Icon name="alert" size={18} />
          Para vender, falta: {missing.join(', ')}.
        </p>
      )}

      <div className={styles.sections}>
        <section className={shared.card} aria-labelledby="dados">
          <h2 id="dados" className={shared.cardTitle}>
            Dados
          </h2>
          <ProductInfoForm product={product} onSaved={(p) => setData((old) => ({ ...old, ...p }))} />
        </section>

        <ImagesSection product={product} onChange={reload} />

        {isKit ? <KitSection product={product} onChange={reload} /> : <VariantsSection product={product} onChange={reload} />}

        <LotsSection product={product} onChange={reload} />

        <section className={cn(shared.card, styles.danger)} aria-labelledby="excluir">
          <h2 id="excluir" className={shared.cardTitle}>
            Excluir produto
          </h2>
          <p className={shared.muted}>Só dá para excluir produto que ainda não teve pedidos. Se já vendeu, use “Ocultar da loja”.</p>
          <Button variant="danger" icon="trash" onClick={() => setDeleteOpen(true)}>
            Excluir produto
          </Button>
        </section>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteProduct(product)
          toast.success('Produto excluído.')
          navigate(ROUTES.ADMIN_PRODUCTS, { replace: true })
        }}
        title={`Excluir "${product.name}"?`}
        description="Fotos, variações e lotes também serão apagados."
        confirmLabel="Excluir"
      />
    </>
  )
}

// ---------------------------------------------------------------------
// Dados básicos
// ---------------------------------------------------------------------
function ProductInfoForm({ product, isNew = false, onSaved }) {
  const toast = useToast()
  const [values, setValues] = useState(() => ({
    name: product?.name || '',
    slug: product?.slug || '',
    kind: product?.kind || 'simple',
    description: product?.description || '',
    is_active: product?.is_active ?? false,
    ask_holder_name: product?.ask_holder_name ?? false,
  }))
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }))

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
      const saved = isNew ? await createProduct(values) : await updateProduct(product.id, values)
      if (!isNew) toast.success('Dados salvos!')
      onSaved?.(saved)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={shared.stack} onSubmit={submit} noValidate>
      {isNew && (
        <div className={styles.kindField}>
          <span className={styles.fieldLabel}>Tipo</span>
          <SegmentedControl
            label="Tipo de produto"
            options={[
              { value: 'simple', label: 'Produto (abadá, copo…)' },
              { value: 'kit', label: 'Kit (junta produtos)' },
            ]}
            value={values.kind}
            onChange={(kind) => set('kind', kind)}
          />
        </div>
      )}
      <div className={shared.formGrid}>
        <Input
          label="Nome"
          value={values.name}
          onChange={(e) => {
            const name = e.target.value
            setValues((v) => ({ ...v, name, slug: slugTouched ? v.slug : slugify(name, 90) }))
          }}
          error={errors.name}
          maxLength={80}
          required
          data-autofocus
        />
        <Input
          label="Endereço (slug)"
          value={values.slug}
          onChange={(e) => {
            setSlugTouched(true)
            set('slug', slugify(e.target.value, 90))
          }}
          error={errors.slug}
          hint={`/loja/${values.slug || 'nome-do-produto'}`}
          required
        />
        <Input
          as="textarea"
          label="Descrição"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={3000}
          className={shared.full}
          hint="Tecido, tamanhos, o que vem no kit, cuidados…"
        />
      </div>
      <Checkbox
        label="Mostrar na loja"
        description="Desmarcado, o produto fica oculto para os clientes."
        checked={values.is_active}
        onChange={(e) => set('is_active', e.target.checked)}
      />
      <Checkbox
        label="Pedir o nome de quem vai usar"
        description="O cliente pode informar um nome por unidade (opcional para ele)."
        checked={values.ask_holder_name}
        onChange={(e) => set('ask_holder_name', e.target.checked)}
      />
      <div>
        <Button type="submit" loading={saving} icon="check">
          {isNew ? 'Criar produto' : 'Salvar dados'}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------
function ImagesSection({ product, onChange }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [uploads, setUploads] = useState([]) // [{ id, name, progress, error }]
  const [busy, setBusy] = useState(false)
  const images = product.product_images

  const onFiles = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, MAX_IMAGES - images.length)
    if (!files.length) return
    setBusy(true)
    const list = files.map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, progress: 0, error: '' }))
    setUploads(list)
    let position = images.length
    for (const [i, file] of files.entries()) {
      try {
        await uploadProductImage(product.id, file, position++, (progress) =>
          setUploads((u) => u.map((x) => (x.id === list[i].id ? { ...x, progress } : x))),
        ).promise
      } catch (err) {
        setUploads((u) => u.map((x) => (x.id === list[i].id ? { ...x, error: getErrorMessage(err, 'Falha no envio.') } : x)))
      }
    }
    setBusy(false)
    setUploads((u) => u.filter((x) => x.error))
    onChange()
  }

  const move = async (index, dir) => {
    const list = [...images]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    try {
      await reorderImages(list)
      onChange()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const remove = async (img) => {
    try {
      await deleteProductImage(img)
      onChange()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <section className={shared.card} aria-labelledby="fotos">
      <h2 id="fotos" className={shared.cardTitle}>
        Fotos
      </h2>
      <p className={shared.muted}>A primeira foto é a capa na vitrine. Até {MAX_IMAGES} fotos, comprimidas automaticamente.</p>
      {images.length > 0 && (
        <ul className={styles.images}>
          {images.map((img, i) => (
            <li key={img.id} className={styles.imageItem}>
              <img src={productImageUrl(img.storage_path, { width: 240 })} alt={`Foto ${i + 1}`} />
              {i === 0 && <span className={styles.coverTag}>Capa</span>}
              <div className={styles.imageActions}>
                <Button variant="ghost" size="sm" iconOnly icon="chevronLeft" aria-label="Mover para a esquerda" disabled={i === 0} onClick={() => move(i, -1)} />
                <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label="Excluir foto" onClick={() => remove(img)} />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon="chevronRight"
                  aria-label="Mover para a direita"
                  disabled={i === images.length - 1}
                  onClick={() => move(i, 1)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {uploads.map((u) => (
        <div key={u.id} className={styles.upload}>
          <span className={shared.muted}>{u.name}</span>
          <ProgressBar value={u.progress} tone={u.error ? 'error' : 'default'} />
          {u.error && <span className={styles.errorText}>{u.error}</span>}
        </div>
      ))}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <div>
        <Button variant="secondary" icon="upload" loading={busy} disabled={images.length >= MAX_IMAGES} onClick={() => inputRef.current?.click()}>
          Adicionar fotos
        </Button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------
// Variações e estoque (produto simples)
// ---------------------------------------------------------------------
function VariantsSection({ product, onChange }) {
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [newStock, setNewStock] = useState('')
  const [adding, setAdding] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const variants = product.product_variants

  const add = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    try {
      await createVariant(product.id, { name: newName, stock: newStock }, variants.length)
      setNewName('')
      setNewStock('')
      onChange()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className={shared.card} aria-labelledby="variacoes">
      <h2 id="variacoes" className={shared.cardTitle}>
        Variações e estoque
      </h2>
      <p className={shared.muted}>
        Ex.: P, M, G, GG, Baby look M. Se o produto não tem variação, deixe só “Único”. Cada pedido feito baixa o estoque na hora; cancelar devolve.
      </p>
      <ul className={styles.variantList}>
        {variants.map((v) => (
          <VariantRow key={`${v.id}-${v.stock}-${v.name}`} variant={v} onChange={onChange} onDelete={() => setToDelete(v)} />
        ))}
      </ul>
      <form className={styles.addRow} onSubmit={add}>
        <Input label="Nova variação" placeholder="Ex.: Baby look M" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
        <Input label="Estoque" type="number" min="0" inputMode="numeric" value={newStock} onChange={(e) => setNewStock(e.target.value)} className={styles.stockInput} />
        <Button type="submit" variant="secondary" icon="plus" loading={adding} disabled={!newName.trim()}>
          Adicionar
        </Button>
      </form>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteVariant(toDelete.id)
          onChange()
        }}
        title={`Excluir a variação "${toDelete?.name}"?`}
        description="Se ela já teve pedidos, não é possível excluir: desative-a."
        confirmLabel="Excluir"
      />
    </section>
  )
}

function VariantRow({ variant, onChange, onDelete }) {
  const toast = useToast()
  const [name, setName] = useState(variant.name)
  const [stock, setStock] = useState(String(variant.stock))
  const [saving, setSaving] = useState(false)
  const dirty = name.trim() !== variant.name || Number(stock) !== variant.stock

  const save = async (patch) => {
    setSaving(true)
    try {
      await updateVariant(variant.id, patch)
      onChange()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={cn(styles.variant, !variant.is_active && styles.inactive)}>
      <Input label="Variação" hideLabel value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={styles.variantName} />
      <Input
        label={`Estoque de ${variant.name}`}
        hideLabel
        type="number"
        min="0"
        inputMode="numeric"
        value={stock}
        onChange={(e) => setStock(e.target.value)}
        className={styles.stockInput}
        suffix="un."
      />
      <div className={styles.variantActions}>
        {dirty && (
          <Button size="sm" icon="check" loading={saving} onClick={() => save({ name, stock })} disabled={!name.trim() || stock === ''}>
            Salvar
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => save({ is_active: !variant.is_active })}>
          {variant.is_active ? 'Desativar' : 'Ativar'}
        </Button>
        <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label={`Excluir ${variant.name}`} onClick={onDelete} />
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------
// Itens do kit
// ---------------------------------------------------------------------
function KitSection({ product, onChange }) {
  const toast = useToast()
  const options = useAsync(listSimpleProducts, [])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const items = product.kit_items
  const available = (options.data || []).filter((p) => !items.some((k) => k.product_id === p.id))

  const run = async (fn) => {
    try {
      await fn()
      onChange()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <section className={shared.card} aria-labelledby="kit">
      <h2 id="kit" className={shared.cardTitle}>
        Itens do kit
      </h2>
      <p className={shared.muted}>O cliente escolhe a variação de cada item (ex.: o tamanho do abadá). Cada kit vendido baixa o estoque desses produtos.</p>
      {items.length === 0 && <p className={shared.muted}>Nenhum item ainda.</p>}
      <ul className={shared.list}>
        {items.map((k) => (
          <li key={k.product_id} className={shared.row}>
            <div className={shared.rowMain}>
              <span className={shared.rowTitle}>{k.component?.name || 'Produto'}</span>
              {k.component && !k.component.is_active && <span className={shared.rowMeta}>Oculto na loja (o kit continua vendendo)</span>}
            </div>
            <div className={shared.rowActions}>
              <Input
                label={`Quantidade de ${k.component?.name}`}
                hideLabel
                type="number"
                min="1"
                max="20"
                defaultValue={k.quantity}
                className={styles.stockInput}
                suffix="un."
                onBlur={(e) => {
                  const q = Math.max(1, Math.min(20, Number(e.target.value) || 1))
                  if (q !== k.quantity) run(() => updateKitItem(product.id, k.product_id, q))
                }}
              />
              <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label="Tirar do kit" onClick={() => run(() => removeKitItem(product.id, k.product_id))} />
            </div>
          </li>
        ))}
      </ul>
      <form
        className={styles.addRow}
        onSubmit={(e) => {
          e.preventDefault()
          if (!productId) return
          run(async () => {
            await addKitItem(product.id, productId, Math.max(1, Math.min(20, Number(quantity) || 1)), items.length)
            setProductId('')
            setQuantity('1')
          })
        }}
      >
        <Input as="select" label="Adicionar produto" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Escolha…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Input>
        <Input label="Qtd." type="number" min="1" max="20" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={styles.stockInput} />
        <Button type="submit" variant="secondary" icon="plus" disabled={!productId}>
          Adicionar
        </Button>
      </form>
      {options.data && options.data.length === 0 && <p className={shared.muted}>Cadastre primeiro os produtos simples (abadá, copo…).</p>}
    </section>
  )
}

// ---------------------------------------------------------------------
// Lotes
// ---------------------------------------------------------------------
function LotsSection({ product, onChange }) {
  const toast = useToast()
  const [editing, setEditing] = useState(null) // null | 'new' | lot
  const [toDelete, setToDelete] = useState(null)
  const lots = product.product_lots
  const active = currentLot(lots)

  const move = async (index, dir) => {
    const list = [...lots]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    try {
      await reorderLots(list)
      onChange()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <section className={shared.card} aria-labelledby="lotes">
      <h2 id="lotes" className={shared.cardTitle}>
        Lotes e preços
      </h2>
      <p className={shared.muted}>
        Vale o primeiro lote da lista que estiver dentro do prazo e não tiver esgotado. Quando ele acaba (data ou quantidade), o próximo assume sozinho.
      </p>
      {lots.length === 0 && <p className={shared.muted}>Nenhum lote ainda: sem lote, o produto não pode ser vendido.</p>}
      <ul className={shared.list}>
        {lots.map((l, i) => (
          <li key={l.id} className={shared.row}>
            <div className={shared.rowMain}>
              <span className={shared.rowTitle}>
                {l.name} · {formatMoney(l.price)}
              </span>
              <span className={shared.rowMeta}>
                {l.quantity_limit ? `${l.sold_count}/${l.quantity_limit} vendidos` : `${l.sold_count} vendidos (sem limite)`}
                {l.starts_at && ` · de ${formatDateTime(l.starts_at)}`}
                {l.ends_at && ` · até ${formatDateTime(l.ends_at)}`}
              </span>
            </div>
            <div className={shared.rowActions}>
              {active?.id === l.id && <span className={cn(shared.badge, shared.badgeSuccess)}>Vigente</span>}
              <Button variant="ghost" size="sm" iconOnly icon="chevronUp" aria-label={`Subir ${l.name}`} disabled={i === 0} onClick={() => move(i, -1)} />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon="chevronDown"
                aria-label={`Descer ${l.name}`}
                disabled={i === lots.length - 1}
                onClick={() => move(i, 1)}
              />
              <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditing(l)}>
                Editar
              </Button>
              <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label={`Excluir ${l.name}`} onClick={() => setToDelete(l)} />
            </div>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="secondary" icon="plus" onClick={() => setEditing('new')}>
          Novo lote
        </Button>
      </div>

      {editing && (
        <LotForm
          lot={editing === 'new' ? null : editing}
          suggestedName={`${lots.length + 1}º lote`}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            if (editing === 'new') await createLot(product.id, values, lots.length)
            else await updateLot(editing.id, values)
            setEditing(null)
            onChange()
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteLot(toDelete.id)
          onChange()
        }}
        title={`Excluir "${toDelete?.name}"?`}
        description="Lote que já teve vendas não pode ser excluído: ajuste a data final para encerrá-lo."
        confirmLabel="Excluir"
      />
    </section>
  )
}

function LotForm({ lot, suggestedName, onClose, onSave }) {
  const toast = useToast()
  const [values, setValues] = useState(() => ({
    name: lot?.name || suggestedName,
    price: moneyInput(lot?.price),
    starts_at: lot?.starts_at ? toDateTimeLocal(lot.starts_at) : '',
    ends_at: lot?.ends_at ? toDateTimeLocal(lot.ends_at) : '',
    quantity_limit: lot?.quantity_limit ? String(lot.quantity_limit) : '',
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const price = parseMoney(values.price)
    const starts = fromDateTimeLocal(values.starts_at)
    const ends = fromDateTimeLocal(values.ends_at)
    const limit = values.quantity_limit ? Number(values.quantity_limit) : null
    const next = {
      name: !values.name.trim() ? 'Dê um nome ao lote.' : '',
      price: price === null || price < 0 ? 'Informe o preço. Ex.: 89,90' : '',
      ends_at: starts && ends && ends <= starts ? 'O fim precisa ser depois do início.' : '',
      quantity_limit: limit !== null && (!Number.isInteger(limit) || limit < 1) ? 'Use um número inteiro maior que zero.' : '',
    }
    if (lot && limit !== null && limit < lot.sold_count) next.quantity_limit = `Já foram vendidos ${lot.sold_count}.`
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    setSaving(true)
    try {
      await onSave({ name: values.name, price, starts_at: starts, ends_at: ends, quantity_limit: limit })
      toast.success('Lote salvo!')
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
      title={lot ? 'Editar lote' : 'Novo lote'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="lot-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="lot-form" className={shared.stack} onSubmit={submit} noValidate>
        <Input label="Nome" value={values.name} onChange={set('name')} error={errors.name} maxLength={40} required data-autofocus />
        <Input label="Preço" prefix="R$" inputMode="decimal" placeholder="89,90" value={values.price} onChange={set('price')} error={errors.price} required />
        <Input
          label="Quantidade máxima (opcional)"
          type="number"
          min="1"
          inputMode="numeric"
          value={values.quantity_limit}
          onChange={set('quantity_limit')}
          error={errors.quantity_limit}
          hint="Quando vender essa quantidade, o lote encerra e o próximo assume."
        />
        <Input label="Começa em (opcional)" type="datetime-local" value={values.starts_at} onChange={set('starts_at')} />
        <Input label="Termina em (opcional)" type="datetime-local" value={values.ends_at} onChange={set('ends_at')} error={errors.ends_at} />
      </form>
    </Modal>
  )
}
