// Nome de usuário com validação em tempo real (formato + disponibilidade)
import { useEffect, useState } from 'react'
import { useDebounce } from '../../../hooks/useDebounce'
import { isUsernameAvailable } from '../../../services/profileService'
import { normalizeUsername, validateUsername } from '../../../utils/validators'
import { Input } from '../../common/Input/Input'
import { Loader } from '../../common/Loader/Loader'

/**
 * onStatusChange recebe: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'
 * currentUsername: o usuário atual (edição de perfil) é considerado disponível
 */
export function UsernameField({ value, onChange, onStatusChange, currentUsername, error: externalError, ...rest }) {
  const debounced = useDebounce(value, 450)
  const [remote, setRemote] = useState({ value: null, status: 'idle' })

  // Status que não depende do servidor (vazio, formato inválido, o próprio usuário)
  let syncStatus = null
  if (!debounced) syncStatus = 'idle'
  else if (validateUsername(debounced)) syncStatus = 'invalid'
  else if (currentUsername && debounced === currentUsername) syncStatus = 'available'

  useEffect(() => {
    if (syncStatus) return undefined
    let cancelled = false
    isUsernameAvailable(debounced)
      .then((ok) => !cancelled && setRemote({ value: debounced, status: ok ? 'available' : 'taken' }))
      .catch(() => !cancelled && setRemote({ value: debounced, status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [debounced, syncStatus])

  const status = syncStatus || (remote.value === debounced ? remote.status : 'checking')

  // Enquanto digita (antes do debounce), considera "verificando"
  const effectiveStatus = value !== debounced && value ? 'checking' : status

  useEffect(() => {
    onStatusChange?.(effectiveStatus)
  }, [effectiveStatus, onStatusChange])

  let error = externalError
  if (!error && effectiveStatus === 'invalid') error = validateUsername(value)
  if (!error && effectiveStatus === 'taken') error = 'Este nome de usuário já está em uso.'
  if (!error && effectiveStatus === 'error') error = 'Não foi possível verificar agora. Tente de novo.'

  return (
    <Input
      label="Nome de usuário"
      value={value}
      onChange={(e) => onChange(normalizeUsername(e.target.value))}
      prefix="@"
      autoComplete="username"
      autoCapitalize="none"
      spellCheck={false}
      maxLength={30}
      hint="Letras minúsculas, números, ponto e sublinhado. Sem espaços."
      error={error}
      success={effectiveStatus === 'available' ? 'Disponível!' : ''}
      suffix={effectiveStatus === 'checking' ? <Loader size="sm" inline /> : null}
      {...rest}
    />
  )
}
