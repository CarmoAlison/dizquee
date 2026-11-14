// Layout do painel: sidebar no desktop; no celular, barra inferior com os
// módulos principais + gaveta "Menu" com todos os módulos permitidos.
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../../../hooks/useAuth'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import { usePermission } from '../../../hooks/usePermission'
import { getMyRoleName } from '../../../services/profileService'
import { cn } from '../../../utils/cn'
import { Icon } from '../../common/Icon/Icon'
import { AdminSidebar } from '../AdminSidebar/AdminSidebar'
import { AdminTopbar } from '../AdminTopbar/AdminTopbar'
import { StatusBanners } from '../StatusBanners/StatusBanners'
import { ADMIN_NAV } from './adminNav'
import styles from './AdminLayout.module.css'

export function AdminLayout() {
  const { profile } = useAuth()
  const { canAccessModule } = usePermission()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [roleName, setRoleName] = useState(null)
  const drawerRef = useFocusTrap(drawerOpen)

  const items = useMemo(() => ADMIN_NAV.filter((item) => !item.module || canAccessModule(item.module)), [canAccessModule])
  const primary = items.filter((i) => i.primary).slice(0, 3)

  useEffect(() => {
    let active = true
    getMyRoleName(profile?.role_id)
      .then((name) => active && setRoleName(name))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [profile?.role_id])

  // A gaveta fecha ao navegar (onNavigate) e com Esc
  useEffect(() => {
    if (!drawerOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className={styles.layout}>
      <a href="#admin-conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      {/* contêiner fixo (sticky): o menu fica parado enquanto a página rola */}
      <aside className={styles.sidebar}>
        <AdminSidebar items={items} />
      </aside>

      <div className={styles.main}>
        <AdminTopbar roleName={roleName} />
        <StatusBanners />
        <main id="admin-conteudo" className={styles.content} tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {/* Celular: barra inferior */}
      <nav className={styles.bottomNav} aria-label="Navegação do painel">
        {primary.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setDrawerOpen(false)} className={({ isActive }) => cn(styles.bottomItem, isActive && styles.bottomActive)}>
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={cn(styles.bottomItem, drawerOpen && styles.bottomActive)}
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-controls="admin-drawer"
        >
          <Icon name="menu" size={22} />
          <span>Menu</span>
        </button>
      </nav>

      {/* Celular: gaveta com todos os módulos */}
      {drawerOpen && (
        <div className={styles.drawerBackdrop} onClick={() => setDrawerOpen(false)}>
          <div
            id="admin-drawer"
            ref={drawerRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Menu do painel"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className={styles.drawerClose} onClick={() => setDrawerOpen(false)} aria-label="Fechar menu">
              <Icon name="close" />
            </button>
            <AdminSidebar items={items} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
