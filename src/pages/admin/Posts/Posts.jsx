// Posts: listar, filtrar (status/categoria/busca), publicar/despublicar, editar e excluir
import { useState } from 'react'
import { Link } from 'react-router'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { useCategories } from '../../../hooks/useCategories'
import { useDebounce } from '../../../hooks/useDebounce'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { deletePost, listAdminPosts, setPostStatus } from '../../../services/postsService'
import { BUCKETS, getPublicUrl } from '../../../services/storageService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { formatDateTime } from '../../../utils/formatDate'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Icon } from '../../../components/common/Icon/Icon'
import { Input } from '../../../components/common/Input/Input'
import { Pagination } from '../../../components/common/Pagination/Pagination'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'

const PAGE_SIZE = 20

export default function Posts() {
  const { user } = useAuth()
  const { has } = usePermission()
  const toast = useToast()
  const { categories } = useCategories()
  const [status, setStatus] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [toDelete, setToDelete] = useState(null)
  const debounced = useDebounce(search, 400)

  const { data, loading, error, reload } = useAsync(
    () => listAdminPosts({ status, categoryId, search: debounced, page, pageSize: PAGE_SIZE }),
    [status, categoryId, debounced, page],
  )

  const resetPage = (fn) => (value) => {
    fn(value)
    setPage(0)
  }

  const canEdit = (p) =>
    has(PERMISSIONS.POSTS_EDIT_ANY) ||
    (p.author_id === user?.id && (has(PERMISSIONS.POSTS_EDIT_OWN) || (has(PERMISSIONS.POSTS_CREATE) && p.status === 'draft')))
  const canDelete = (p) => has(PERMISSIONS.POSTS_DELETE_ANY) || (p.author_id === user?.id && has(PERMISSIONS.POSTS_DELETE_OWN))
  const canPublish = has(PERMISSIONS.POSTS_PUBLISH)

  const togglePublish = async (p) => {
    try {
      await setPostStatus(p.id, p.status === 'published' ? 'draft' : 'published')
      toast.success(p.status === 'published' ? 'Post despublicado.' : 'Post publicado!')
      reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const posts = data?.posts || []
  const categoryName = (id) => categories.find((c) => c.id === id)?.name

  return (
    <>
      <PageHeader
        title="Posts"
        description="Fotos, vídeos e novidades do bloco."
        actions={
          has(PERMISSIONS.POSTS_CREATE) && (
            <Button to={ROUTES.ADMIN_POST_NEW} icon="plus">
              Novo post
            </Button>
          )
        }
      />

      <div className={shared.toolbar}>
        <Input label="Buscar pelo título" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} type="search" />
        <Input as="select" label="Categoria" value={categoryId} onChange={(e) => resetPage(setCategoryId)(e.target.value)}>
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Input>
        <SegmentedControl
          label="Status"
          value={status}
          onChange={resetPage(setStatus)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'published', label: 'Publicados' },
            { value: 'draft', label: 'Rascunhos' },
          ]}
        />
      </div>

      {loading && <Skeleton height={240} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && posts.length === 0 && (
        <EmptyState icon="posts" title="Nenhum post encontrado" description="Ajuste os filtros ou crie o primeiro post." />
      )}

      {!loading && posts.length > 0 && (
        <ul className={shared.list}>
          {posts.map((p) => {
            const cover = p.media.find((m) => m.type === 'image') || p.media[0]
            return (
              <li key={p.id} className={shared.row}>
                {cover?.type === 'image' ? (
                  <img className={shared.thumb} src={getPublicUrl(BUCKETS.POST_MEDIA, cover.storage_path)} alt="" loading="lazy" />
                ) : (
                  <span className={shared.thumb}>
                    <Icon name={cover ? 'video' : 'posts'} />
                  </span>
                )}
                <div className={shared.rowMain}>
                  {canEdit(p) ? (
                    <Link to={ROUTES.ADMIN_POST_EDIT(p.id)} className={shared.rowTitle}>
                      {p.title}
                    </Link>
                  ) : (
                    <span className={shared.rowTitle}>{p.title}</span>
                  )}
                  <span className={shared.rowMeta}>
                    <span className={cn(shared.badge, p.status === 'published' ? shared.badgeSuccess : shared.badgeWarning)}>
                      {p.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>{' '}
                    {p.published_at ? formatDateTime(p.published_at) : `criado ${formatDateTime(p.created_at)}`} ·{' '}
                    {p.author?.full_name || 'Sem autor'} · {p.like_count} curtidas · {p.comment_count} comentários
                    {p.categoryIds.length > 0 && ` · ${p.categoryIds.map(categoryName).filter(Boolean).join(', ')}`}
                  </span>
                </div>
                <div className={shared.rowActions}>
                  {p.status === 'published' && (
                    <Button to={ROUTES.POST(p.slug)} variant="ghost" size="sm" iconOnly icon="eye" aria-label={`Ver ${p.title} no site`} />
                  )}
                  {canPublish && (canEdit(p) || has(PERMISSIONS.POSTS_EDIT_ANY)) && (
                    <Button variant="secondary" size="sm" onClick={() => togglePublish(p)}>
                      {p.status === 'published' ? 'Despublicar' : 'Publicar'}
                    </Button>
                  )}
                  {canEdit(p) && <Button to={ROUTES.ADMIN_POST_EDIT(p.id)} variant="secondary" size="sm" icon="edit">Editar</Button>}
                  {canDelete(p) && (
                    <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label={`Excluir ${p.title}`} onClick={() => setToDelete(p)} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onChange={setPage} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deletePost(toDelete)
          toast.success('Post excluído.')
          reload()
        }}
        title="Excluir este post?"
        description={`"${toDelete?.title}" será apagado com fotos, vídeos, curtidas e comentários. Não dá para desfazer.`}
        confirmLabel="Excluir post"
      />
    </>
  )
}
