// Moderação: localizar e excluir comentários de posts e stories
import { useState } from 'react'
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useDebounce } from '../../../hooks/useDebounce'
import { useToast } from '../../../hooks/useToast'
import { deleteComment } from '../../../services/commentsService'
import { listCommentsForModeration } from '../../../services/moderationService'
import { formatDateTime } from '../../../utils/formatDate'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Avatar } from '../../../components/common/Avatar/Avatar'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Pagination } from '../../../components/common/Pagination/Pagination'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'
import styles from './Comments.module.css'

const PAGE_SIZE = 25

export default function Comments() {
  const toast = useToast()
  const [kind, setKind] = useState('post')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [toDelete, setToDelete] = useState(null)
  const debounced = useDebounce(search, 400)
  const { data, loading, error, reload } = useAsync(
    () => listCommentsForModeration({ kind, search: debounced, page, pageSize: PAGE_SIZE }),
    [kind, debounced, page],
  )
  const comments = data?.comments || []

  return (
    <>
      <PageHeader title="Comentários" description="Comentários aparecem direto no site. Aqui você localiza e remove o que for preciso." />

      <div className={shared.toolbar}>
        <SegmentedControl
          label="Origem"
          value={kind}
          onChange={(v) => {
            setKind(v)
            setPage(0)
          }}
          options={[
            { value: 'post', label: 'Posts' },
            { value: 'story', label: 'Stories' },
          ]}
        />
        <Input
          label="Buscar no texto"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
      </div>

      {loading && <Skeleton height={260} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && comments.length === 0 && <EmptyState icon="comment" title="Nenhum comentário encontrado" />}

      {!loading && comments.length > 0 && (
        <ul className={shared.list}>
          {comments.map((c) => (
            <li key={c.id} className={shared.row}>
              <Avatar src={c.author?.avatar_url} name={c.author?.full_name || c.author?.username} size={40} />
              <div className={shared.rowMain}>
                <span className={shared.rowMeta}>
                  <Link to={ROUTES.ADMIN_USER(c.user_id)}>
                    <strong>{c.author?.full_name || 'Usuário'}</strong>
                  </Link>
                  {c.author?.username && ` @${c.author.username}`} · {formatDateTime(c.created_at)}
                  {c.parent_id && ' · resposta'}
                </span>
                <p className={styles.text}>{c.content}</p>
                <span className={shared.rowMeta}>
                  {kind === 'post' ? (
                    c.posts ? (
                      <>
                        em <Link to={`${ROUTES.POST(c.posts.slug)}#comentarios`}>{c.posts.title}</Link>
                      </>
                    ) : (
                      'em post não publicado'
                    )
                  ) : (
                    `em story: ${c.stories?.caption || (c.stories?.media_type === 'video' ? 'vídeo' : 'imagem')}`
                  )}
                </span>
              </div>
              <div className={shared.rowActions}>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => setToDelete(c)}>
                  Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onChange={setPage} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteComment(kind, toDelete.id)
          toast.success('Comentário excluído.')
          reload()
        }}
        title="Excluir comentário?"
        description="As respostas dele também serão removidas. A ação fica registrada na auditoria."
        confirmLabel="Excluir"
      />
    </>
  )
}
