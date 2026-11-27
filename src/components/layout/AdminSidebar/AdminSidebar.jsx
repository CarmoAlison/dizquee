// Menu lateral do admin (desktop) e conteúdo da gaveta (celular)
import { Link, NavLink } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { cn } from '../../../utils/cn'
import { Icon } from '../../common/Icon/Icon'
import { Logo } from '../../common/Logo/Logo'
import { groupNavItems } from '../AdminLayout/adminNav'
import styles from './AdminSidebar.module.css'

export function AdminSidebar({ items, onNavigate, className }) {
  return (
    <nav className={cn(styles.sidebar, className)} aria-label="Menu do painel">
      <Link to={ROUTES.ADMIN} className={styles.brand} onClick={onNavigate}>
        <Logo tone="light" />
        {/* <span className={styles.badge}>Painel</span> */}
      </Link>
      <hr />
      <div className={styles.groups}>
        {groupNavItems(items).map(({ group, items: groupItems }) => (
          <div key={group || 'geral'} className={styles.group} role={group ? 'group' : undefined} aria-label={group || undefined}>
            {group && (
              <p className={styles.groupTitle} aria-hidden="true">
                {group}
              </p>
            )}
            <ul className={styles.list} role="list">
              {groupItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) => cn(styles.link, isActive && styles.active)}
                  >
                    <Icon name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Link to={ROUTES.HOME} className={styles.siteLink} onClick={onNavigate}>
        <Icon name="external" size={18} />
        Ver o site
      </Link>
    </nav>
  )
}
