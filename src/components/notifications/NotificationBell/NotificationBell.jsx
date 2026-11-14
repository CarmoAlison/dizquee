// Sino com contador (desktop): abre um painel com as últimas notificações
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useNotifications } from '../../../hooks/useNotifications'
import { Icon } from '../../common/Icon/Icon'
import { NotificationList } from '../NotificationList/NotificationList'
import styles from './NotificationBell.module.css'

export function NotificationBell() {
  const { unread } = useNotifications()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return undefined
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} className={styles.panel} role="region" aria-label="Notificações recentes">
          <div className={styles.panelHeader}>
            <h2 className={styles.title}>Notificações</h2>
            <Link to={ROUTES.NOTIFICATIONS} className={styles.seeAll} onClick={() => setOpen(false)}>
              Ver todas
            </Link>
          </div>
          <div className={styles.panelBody}>
            <NotificationList compact limit={8} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
