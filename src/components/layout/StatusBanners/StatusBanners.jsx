// Avisos fixos: conta suspensa (banida) e sem conexão
import { useEffect, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { formatLongDate } from '../../../utils/formatDate'
import { Icon } from '../../common/Icon/Icon'
import styles from './StatusBanners.module.css'

export function StatusBanners() {
  const { isBanned, profile } = useAuth()
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <>
      {isBanned && (
        <div className={styles.banned} role="alert">
          <Icon name="ban" size={20} />
          <p>
            <strong>Sua conta está suspensa</strong>
            {profile?.banned_at && ` desde ${formatLongDate(profile.banned_at)}`}. Você pode ver o conteúdo, mas não pode
            curtir, comentar ou reagir.
            {profile?.banned_reason && <span className={styles.reason}> Motivo: {profile.banned_reason}</span>}
          </p>
        </div>
      )}
      {!online && (
        <div className={styles.offline} role="status">
          <Icon name="alert" size={18} />
          <p>Você está sem internet. Algumas informações podem estar desatualizadas.</p>
        </div>
      )}
    </>
  )
}
