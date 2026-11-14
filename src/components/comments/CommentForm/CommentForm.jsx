// Campo para comentar/responder. Visitante: abre o modal de login.
import { useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { useInteractionGuard } from '../../../hooks/useInteractionGuard'
import { useToast } from '../../../hooks/useToast'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { Avatar } from '../../common/Avatar/Avatar'
import { Icon } from '../../common/Icon/Icon'
import { Loader } from '../../common/Loader/Loader'
import styles from './CommentForm.module.css'

export function CommentForm({
  onSubmit,
  placeholder = 'Escreva um comentário…',
  maxLength = 1000,
  initialValue = '',
  autoFocus = false,
  onCancel,
  compact = false,
  tone = 'default',
  label = 'Comentário',
}) {
  const { profile, isAuthenticated } = useAuth()
  const guard = useInteractionGuard()
  const toast = useToast()
  const [value, setValue] = useState(initialValue)
  const [sending, setSending] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!guard('Entre para comentar.')) return
    const text = value.trim()
    if (!text) return
    setSending(true)
    try {
      await onSubmit(text)
      setValue('')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Não foi possível enviar o comentário.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <form className={cn(styles.form, compact && styles.compact, tone === 'dark' && styles.dark)} onSubmit={submit}>
      {!compact && <Avatar src={profile?.avatar_url} name={profile?.full_name || profile?.username} size={36} />}
      <div className={styles.field}>
        <label className="visually-hidden" htmlFor={`comment-${label}`}>
          {label}
        </label>
        <textarea
          id={`comment-${label}`}
          className={styles.textarea}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
          onFocus={() => {
            if (!isAuthenticated) guard('Entre para comentar.')
          }}
          placeholder={placeholder}
          rows={1}
          maxLength={maxLength}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e)
            if (e.key === 'Escape' && onCancel) onCancel()
          }}
        />
        {value.length > maxLength * 0.8 && (
          <span className={styles.counter} aria-live="polite">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      {onCancel && (
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancelar
        </button>
      )}
      <button type="submit" className={styles.send} disabled={!value.trim() || sending} aria-label="Enviar comentário">
        {sending ? <Loader size="sm" inline /> : <Icon name="send" size={20} />}
      </button>
    </form>
  )
}
