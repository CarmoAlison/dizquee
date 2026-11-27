// Navegação inferior no celular: Início, Stories, Loja, Notificações, Perfil
import { NavLink } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAuth } from '../../../hooks/useAuth'
import { useNotifications } from '../../../hooks/useNotifications'
import { cn } from '../../../utils/cn'
import { Icon } from '../../common/Icon/Icon'
import styles from './BottomNav.module.css'

export function BottomNav() {
  const { isAuthenticated } = useAuth()
  const { unread } = useNotifications()

  const items = [
    { to: ROUTES.HOME, label: 'Início', icon: 'home', end: true },
    { to: ROUTES.STORIES, label: 'Stories', icon: 'stories' },
    { to: ROUTES.SHOP, label: 'Loja', icon: 'bag' },
    { to: ROUTES.NOTIFICATIONS, label: 'Notificações', icon: 'bell', badge: isAuthenticated ? unread : 0 },
    { to: isAuthenticated ? ROUTES.PROFILE : ROUTES.LOGIN, label: isAuthenticated ? 'Perfil' : 'Entrar', icon: isAuthenticated ? 'user' : 'login' },
  ]

  return (
    <nav className={styles.nav} aria-label="Navegação inferior">
      {items.map((item) => (
        <NavLink key={item.label} to={item.to} end={item.end} className={({ isActive }) => cn(styles.item, isActive && styles.active)}>
          <span className={styles.iconWrap}>
            <Icon name={item.icon} size={24} />
            {item.badge > 0 && (
              <span className={styles.badge}>
                {item.badge > 99 ? '99+' : item.badge}
                <span className="visually-hidden"> não lidas</span>
              </span>
            )}
          </span>
          <span className={styles.label}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
