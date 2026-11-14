// Criar (/admin/posts/novo) ou editar (/admin/posts/:id) um post
import { useParams } from 'react-router'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { usePermission } from '../../../hooks/usePermission'
import { getPostById } from '../../../services/postsService'
import { AccessDenied } from '../../../components/auth/AccessDenied/AccessDenied'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Loader } from '../../../components/common/Loader/Loader'
import { PostForm } from '../../../components/posts/PostForm/PostForm'

export default function PostEditor() {
  const { id } = useParams()
  const isNew = !id
  const { user } = useAuth()
  const { has } = usePermission()
  const { data: post, loading, error, reload } = useAsync(() => (isNew ? Promise.resolve(null) : getPostById(id)), [id])

  if (!isNew && loading) return <Loader fullPage />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!isNew && !post) {
    return <EmptyState icon="posts" title="Post não encontrado" action={<Button to={ROUTES.ADMIN_POSTS}>Voltar aos posts</Button>} />
  }

  if (post) {
    const canEdit =
      has(PERMISSIONS.POSTS_EDIT_ANY) ||
      (post.author_id === user?.id && (has(PERMISSIONS.POSTS_EDIT_OWN) || (has(PERMISSIONS.POSTS_CREATE) && post.status === 'draft')))
    if (!canEdit) return <AccessDenied />
  }

  return (
    <>
      <PageHeader
        title={isNew ? 'Novo post' : 'Editar post'}
        actions={
          post?.status === 'published' && (
            <Button to={ROUTES.POST(post.slug)} variant="secondary" icon="eye">
              Ver no site
            </Button>
          )
        }
      />
      <PostForm key={post?.id || 'new'} post={post} />
    </>
  )
}
