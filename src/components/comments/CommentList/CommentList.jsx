// Seção de comentários com respostas em thread (1 nível).
// kind: 'post' | 'story'
import { useState } from 'react'
import { useComments } from '../../../hooks/useComments'
import { useInteractionGuard } from '../../../hooks/useInteractionGuard'
import { useToast } from '../../../hooks/useToast'
import { cn } from '../../../utils/cn'
import { EmptyState } from '../../common/EmptyState/EmptyState'
import { ErrorState } from '../../common/ErrorState/ErrorState'
import { Skeleton } from '../../common/Skeleton/Skeleton'
import { CommentForm } from '../CommentForm/CommentForm'
import { CommentItem } from '../CommentItem/CommentItem'
import styles from './CommentList.module.css'

export function CommentList({ kind, targetId, maxLength = 1000, tone = 'default', onCountChange }) {
  const { threads, loading, error, add, remove, reload, total } = useComments(kind, targetId)
  const guard = useInteractionGuard()
  const toast = useToast()
  const [replyTo, setReplyTo] = useState(null) // { rootId, mention }

  const handleAdd = async (text) => {
    await add(text)
    onCountChange?.(total + 1)
  }

  const handleReply = async (text) => {
    await add(text, replyTo.rootId)
    setReplyTo(null)
    onCountChange?.(total + 1)
  }

  // Erros aparecem dentro do diálogo de confirmação
  const handleDelete = async (id) => {
    await remove(id)
    toast.success('Comentário excluído.')
    onCountChange?.(Math.max(0, total - 1))
  }

  const startReply = (comment, rootId) => {
    if (!guard('Entre para responder.')) return
    const mention = comment.author?.username && comment.id !== rootId ? `@${comment.author.username} ` : ''
    setReplyTo({ rootId, mention, key: comment.id })
  }

  return (
    <section className={cn(styles.section, tone === 'dark' && styles.dark)} aria-label="Comentários">
      <CommentForm onSubmit={handleAdd} maxLength={maxLength} tone={tone} compact={tone === 'dark'} label={`novo-${kind}`} />

      {loading && (
        <div className={styles.list} aria-hidden="true">
          {[1, 2].map((i) => (
            <div key={i} className={styles.skeleton}>
              <Skeleton variant="circle" width={36} height={36} />
              <Skeleton height={52} />
            </div>
          ))}
        </div>
      )}

      {!loading && error && <ErrorState error={error} onRetry={reload} compact title="Não foi possível carregar os comentários" />}

      {!loading && !error && threads.length === 0 && (
        <EmptyState compact icon="comment" title="Seja a primeira pessoa a comentar" />
      )}

      {!loading && threads.length > 0 && (
        <ul className={styles.list} role="list">
          {threads.map((thread) => (
            <li key={thread.id} className={styles.thread}>
              <CommentItem comment={thread} tone={tone} onReply={(c) => startReply(c, thread.id)} onDelete={handleDelete} />
              {thread.replies.length > 0 && (
                <ul className={styles.replies} role="list">
                  {thread.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentItem
                        comment={reply}
                        isReply
                        tone={tone}
                        onReply={(c) => startReply(c, thread.id)}
                        onDelete={handleDelete}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {replyTo?.rootId === thread.id && (
                <div className={styles.replyForm}>
                  <CommentForm
                    key={replyTo.key}
                    onSubmit={handleReply}
                    initialValue={replyTo.mention}
                    placeholder="Escreva uma resposta…"
                    maxLength={maxLength}
                    autoFocus
                    compact
                    tone={tone}
                    label={`resposta-${thread.id}`}
                    onCancel={() => setReplyTo(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
