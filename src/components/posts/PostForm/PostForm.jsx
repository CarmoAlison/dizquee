// Formulário do post: título, slug, texto, categorias, status, data e mídias
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useCategories } from '../../../hooks/useCategories'
import { usePermission } from '../../../hooks/usePermission'
import { usePostEditor } from '../../../hooks/usePostEditor'
import { useToast } from '../../../hooks/useToast'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { fromDateTimeLocal, toDateTimeLocal } from '../../../utils/formatDate'
import { slugify } from '../../../utils/slugify'
import { Button } from '../../common/Button/Button'
import { Input } from '../../common/Input/Input'
import { SegmentedControl } from '../../common/SegmentedControl/SegmentedControl'
import { toMediaItems } from '../../../utils/mediaItems'
import { MediaManager } from '../MediaManager/MediaManager'
import styles from './PostForm.module.css'

export function PostForm({ post }) {
  const navigate = useNavigate()
  const toast = useToast()
  const canPublish = usePermission(PERMISSIONS.POSTS_PUBLISH)
  const { categories, loading: categoriesLoading } = useCategories()
  const { save, saving } = usePostEditor(post)

  const [values, setValues] = useState({
    title: post?.title || '',
    slug: post?.slug || '',
    content: post?.content || '',
    categoryIds: post?.categoryIds || [],
    status: post?.status || 'draft',
    publishedAt: post?.published_at || null,
  })
  const [slugTouched, setSlugTouched] = useState(Boolean(post))
  const [items, setItems] = useState(() => toMediaItems(post?.media))
  const [removed, setRemoved] = useState([])
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }))

  const toggleCategory = (id) =>
    set('categoryIds', values.categoryIds.includes(id) ? values.categoryIds.filter((c) => c !== id) : [...values.categoryIds, id])

  const submit = async (e) => {
    e.preventDefault()
    const next = {
      title: values.title.trim().length < 3 ? 'O título precisa ter pelo menos 3 caracteres.' : '',
      categories: values.categoryIds.length === 0 ? 'Escolha pelo menos uma categoria.' : '',
      media: items.some((it) => it.status === 'processing') ? 'Aguarde o processamento das mídias.' : '',
    }
    setErrors(next)
    setFormError('')
    if (Object.values(next).some(Boolean)) return
    try {
      await save({
        values: { ...values, slug: values.slug || slugify(values.title) },
        items,
        setItems,
        removed,
        clearRemoved: () => setRemoved([]),
      })
      const hasErrors = items.some((it) => it.status === 'error')
      toast.success(hasErrors ? 'Post salvo. Itens com erro não foram enviados.' : 'Post salvo!')
      if (!hasErrors) navigate(ROUTES.ADMIN_POSTS)
    } catch (err) {
      setFormError(getErrorMessage(err, err.message))
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.main}>
        <section className={styles.card}>
          <Input
            label="Título"
            value={values.title}
            onChange={(e) => {
              const title = e.target.value
              setValues((v) => ({ ...v, title, slug: slugTouched ? v.slug : slugify(title) }))
            }}
            error={errors.title}
            maxLength={150}
            required
          />
          <Input
            label="Endereço (slug)"
            prefix="/post/"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true)
              set('slug', slugify(e.target.value, 180))
            }}
            hint="Gerado a partir do título. Mudar depois de publicar quebra links já compartilhados."
          />
          <Input
            as="textarea"
            label="Texto"
            value={values.content}
            onChange={(e) => set('content', e.target.value)}
            maxLength={10000}
            rows={8}
            hint={`${values.content.length}/10000`}
          />
        </section>

        <section className={styles.card}>
          <MediaManager
            items={items}
            setItems={setItems}
            onRemove={(item) => item.kind === 'existing' && setRemoved((r) => [...r, item])}
            disabled={saving}
          />
          {errors.media && <p className={styles.error}>{errors.media}</p>}
        </section>
      </div>

      <aside className={styles.side}>
        <section className={styles.card}>
          <span className={styles.label}>Status</span>
          {canPublish ? (
            <SegmentedControl
              label="Status do post"
              value={values.status}
              onChange={(status) => setValues((v) => ({ ...v, status, publishedAt: status === 'published' ? v.publishedAt || new Date().toISOString() : v.publishedAt }))}
              options={[
                { value: 'draft', label: 'Rascunho' },
                { value: 'published', label: 'Publicado' },
              ]}
            />
          ) : (
            <p className={styles.small}>
              {values.status === 'published' ? 'Publicado' : 'Rascunho'} — publicar exige a permissão de publicação.
            </p>
          )}
          <Input
            label="Data de publicação"
            type="datetime-local"
            value={values.publishedAt ? toDateTimeLocal(values.publishedAt) : ''}
            onChange={(e) => set('publishedAt', fromDateTimeLocal(e.target.value))}
            hint="Com data futura, o post publicado só aparece a partir dela."
          />
        </section>

        <section className={styles.card}>
          <span className={styles.label}>Categorias</span>
          {categoriesLoading ? (
            <p className={styles.small}>Carregando…</p>
          ) : categories.length === 0 ? (
            <p className={styles.small}>
              Nenhuma categoria. <Link to={ROUTES.ADMIN_CATEGORIES}>Crie categorias</Link> primeiro.
            </p>
          ) : (
            <div className={styles.chips} role="group" aria-label="Categorias do post">
              {categories.map((c) => {
                const active = values.categoryIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(styles.chip, active && styles.chipActive)}
                    aria-pressed={active}
                    onClick={() => toggleCategory(c.id)}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
          )}
          {errors.categories && <p className={styles.error}>{errors.categories}</p>}
        </section>

      </aside>

      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}

      <div className={styles.actions}>
        <Button variant="ghost" to={ROUTES.ADMIN_POSTS}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving} size="lg">
          Salvar post
        </Button>
      </div>
    </form>
  )
}
