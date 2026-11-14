// Perfil detalhado do cliente: dados, histórico de curtidas e comentários,
// banir/desbanir com motivo
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { banUser, getUser, getUserHistory, unbanUser } from '../../../services/usersService'
import { cn } from '../../../utils/cn'
import { formatDateTime, formatLongDate } from '../../../utils/formatDate'
import { formatPhone } from '../../../utils/validators'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Avatar } from '../../../components/common/Avatar/Avatar'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Loader } from '../../../components/common/Loader/Loader'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import shared from '../adminShared.module.css'
import styles from './UserDetails.module.css'

export default function UserDetails() {
  const { id } = useParams()
  const { user: me } = useAuth()
  const { has } = usePermission()
  const toast = useToast()
  const { data: user, loading, error, reload } = useAsync(() => getUser(id), [id])
  const canHistory = has(PERMISSIONS.USERS_VIEW_HISTORY)
  const history = useAsync(() => getUserHistory(id), [id], { enabled: canHistory })
  const [tab, setTab] = useState('comments')
  const [banOpen, setBanOpen] = useState(false)
  const [unbanOpen, setUnbanOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (loading) return <Loader fullPage />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!user) return <EmptyState icon="users" title="Usuário não encontrado" action={<Button to={ROUTES.ADMIN_USERS}>Voltar</Button>} />

  const isMe = user.id === me?.id

  return (
    <>
      <PageHeader
        title={user.full_name || 'Sem nome'}
        description={user.username ? `@${user.username}` : 'Cadastro incompleto'}
        actions={
          <Button to={ROUTES.ADMIN_USERS} variant="ghost" icon="arrowLeft">
            Clientes
          </Button>
        }
      />

      <div className={styles.layout}>
        <section className={shared.card}>
          <div className={styles.profile}>
            <Avatar src={user.avatar_url} name={user.full_name || user.username} size={72} />
            <div className={styles.badges}>
              {user.is_staff && <span className={cn(shared.badge, shared.badgeAccent)}>Equipe</span>}
              {user.is_banned ? (
                <span className={cn(shared.badge, shared.badgeDanger)}>Banido</span>
              ) : (
                <span className={cn(shared.badge, shared.badgeSuccess)}>Ativo</span>
              )}
            </div>
          </div>
          <dl className={styles.data}>
            <dt>E-mail</dt>
            <dd>{user.email || '—'}</dd>
            <dt>Telefone</dt>
            <dd>{formatPhone(user.phone) || '—'}</dd>
            <dt>Cadastro</dt>
            <dd>{formatDateTime(user.created_at)}</dd>
            <dt>Termos aceitos</dt>
            <dd>{user.terms_accepted_at ? `${formatDateTime(user.terms_accepted_at)} (v${user.terms_version})` : 'Não'}</dd>
            {user.is_banned && (
              <>
                <dt>Banido em</dt>
                <dd>{formatLongDate(user.banned_at)}</dd>
                <dt>Motivo</dt>
                <dd>{user.banned_reason || '—'}</dd>
              </>
            )}
          </dl>
          {!isMe && (
            <div className={styles.actions}>
              {!user.is_banned && has(PERMISSIONS.USERS_BAN) && (
                <Button variant="danger" icon="ban" onClick={() => setBanOpen(true)}>
                  Banir usuário
                </Button>
              )}
              {user.is_banned && has(PERMISSIONS.USERS_UNBAN) && (
                <Button variant="secondary" icon="check" onClick={() => setUnbanOpen(true)}>
                  Desbanir
                </Button>
              )}
            </div>
          )}
        </section>

        <section className={shared.card} aria-labelledby="history-title">
          <div className={styles.historyHeader}>
            <h2 id="history-title" className={shared.cardTitle}>
              Histórico
            </h2>
            {canHistory && (
              <SegmentedControl
                label="Tipo de histórico"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'comments', label: 'Comentários' },
                  { value: 'likes', label: 'Curtidas' },
                  { value: 'stories', label: 'Em stories' },
                ]}
              />
            )}
          </div>
          {!canHistory ? (
            <p className={shared.muted}>Você não tem permissão para ver o histórico.</p>
          ) : history.loading ? (
            <Loader />
          ) : history.error ? (
            <ErrorState error={history.error} onRetry={history.reload} compact />
          ) : (
            <HistoryList tab={tab} data={history.data} />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={banOpen}
        onClose={() => {
          setBanOpen(false)
          setReason('')
        }}
        onConfirm={async () => {
          await banUser(user.id, reason)
          toast.success('Usuário banido.')
          reload()
        }}
        title="Banir este usuário?"
        description="Ele continua vendo o site, mas não poderá curtir, comentar nem reagir."
        confirmLabel="Banir"
        confirmDisabled={reason.trim().length < 3}
      >
        <Input as="textarea" label="Motivo (aparece para o usuário)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      </ConfirmDialog>

      <ConfirmDialog
        open={unbanOpen}
        onClose={() => setUnbanOpen(false)}
        onConfirm={async () => {
          await unbanUser(user.id)
          toast.success('Usuário desbanido.')
          reload()
        }}
        title="Desbanir este usuário?"
        description="Ele volta a poder interagir normalmente."
        confirmLabel="Desbanir"
        danger={false}
      />
    </>
  )
}

function HistoryList({ tab, data }) {
  const list = tab === 'likes' ? data?.likes : tab === 'stories' ? data?.storyComments : data?.comments
  if (!list?.length) return <p className={shared.muted}>Nada por aqui.</p>
  return (
    <ul className={shared.list}>
      {list.map((item) => (
        <li key={item.id || `${item.post_id}-${item.created_at}`} className={styles.historyItem}>
          {tab === 'likes' ? (
            <p>
              Curtiu{' '}
              {item.posts ? <Link to={ROUTES.POST(item.posts.slug)}>{item.posts.title}</Link> : 'um post removido'}
            </p>
          ) : (
            <>
              <p className={styles.comment}>“{item.content}”</p>
              <p className={shared.rowMeta}>
                {item.parent_id ? 'Resposta em ' : 'Em '}
                {tab === 'stories'
                  ? item.stories?.caption || 'um story'
                  : item.posts
                    ? <Link to={`${ROUTES.POST(item.posts.slug)}#comentarios`}>{item.posts.title}</Link>
                    : 'post removido'}
              </p>
            </>
          )}
          <time className={shared.rowMeta} dateTime={item.created_at}>
            {formatDateTime(item.created_at)}
          </time>
        </li>
      ))}
    </ul>
  )
}
