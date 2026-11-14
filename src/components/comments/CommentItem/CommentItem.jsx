// Um comentário (com ações de responder e excluir). Texto sempre como
// texto puro (sem HTML), preservando quebras de linha.
import { useState } from 'react'
import { PERMISSIONS } from '../../../constants/permissions'
import { useAuth } from '../../../hooks/useAuth'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { formatDateTime, formatRelative } from '../../../utils/formatDate'
import { Avatar } from '../../common/Avatar/Avatar'
import { ConfirmDialog } from '../../common/ConfirmDialog/ConfirmDialog'
import styles from './CommentItem.module.css'

export function CommentItem({ comment, onReply, onDelete, isReply = false, tone = 'default' }) {
  const { user } = useAuth()
  const canDeleteAny = usePermission(PERMISSIONS.COMMENTS_DELETE_ANY)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const author = comment.author
  const name = author?.full_name || author?.username || 'Usuário'
  const isOwn = user?.id === comment.user_id
  const canDelete = isOwn || canDeleteAny

  return (
    <div className={cn(styles.item, isReply && styles.reply, tone === 'dark' && styles.dark)}>
      <Avatar src={author?.avatar_url} name={name} size={isReply ? 30 : 36} />
      <div className={styles.content}>
        <div className={styles.bubble}>
          <p className={styles.header}>
            <span className={styles.name}>{name}</span>
            {author?.username && <span className={styles.username}>@{author.username}</span>}
            {author?.is_staff && <span className={styles.badge}>Bloco</span>}
          </p>
          <p className={styles.text}>{comment.content}</p>
        </div>
        <div className={styles.actions}>
          <time dateTime={comment.created_at} title={formatDateTime(comment.created_at)}>
            {formatRelative(comment.created_at)}
          </time>
          {onReply && (
            <button type="button" className={styles.action} onClick={() => onReply(comment)}>
              Responder
            </button>
          )}
          {canDelete && onDelete && (
            <button type="button" className={cn(styles.action, styles.danger)} onClick={() => setConfirmOpen(true)}>
              Excluir
            </button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => onDelete(comment.id)}
        title="Excluir comentário?"
        description={
          isReply
            ? 'Esta resposta será removida.'
            : 'O comentário e as respostas dele serão removidos. Não dá para desfazer.'
        }
        confirmLabel="Excluir"
      />
    </div>
  )
}
