// Header: no celular é uma barra compacta (logo + tema + entrar);
// no desktop traz a navegação completa, sino de notificações e menu do perfil.
import { Link, NavLink, useLocation } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAuth } from '../../../hooks/useAuth'
import { useCart } from '../../../hooks/useCart'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { Avatar } from '../../common/Avatar/Avatar'
import { Button } from '../../common/Button/Button'
import { Icon } from '../../common/Icon/Icon'
import { Logo } from '../../common/Logo/Logo'
import { ThemeToggle } from '../../common/ThemeToggle/ThemeToggle'
import { NotificationBell } from '../../notifications/NotificationBell/NotificationBell'
import styles from './Header.module.css'

export function Header() {
  const { isAuthenticated, profile } = useAuth()
  const { canAccessAdmin } = usePermission()
  const { count: cartCount } = useCart()
  const location = useLocation()
  const loginTarget = `${ROUTES.LOGIN}?redirect=${encodeURIComponent(location.pathname + location.search)}`

  return (
    <header className={styles.header}>
      <div className={cn('container', styles.inner)}>
        <Link to={ROUTES.HOME} className={styles.brand} aria-label="Página inicial">
          <Logo tone="light" />
        </Link>

        <nav className={styles.nav} aria-label="Principal">
          <NavLink to={ROUTES.HOME} end className={({ isActive }) => cn(styles.link, isActive && styles.active)}>
            Início
          </NavLink>
          <NavLink to={ROUTES.STORIES} className={({ isActive }) => cn(styles.link, isActive && styles.active)}>
            Stories
          </NavLink>
          <NavLink to={ROUTES.SHOP} className={({ isActive }) => cn(styles.link, isActive && styles.active)}>
            Loja
          </NavLink>
          {isAuthenticated && (
            <NavLink to={ROUTES.MY_ORDERS} className={({ isActive }) => cn(styles.link, isActive && styles.active)}>
              Meus pedidos
            </NavLink>
          )}
          {canAccessAdmin && (
            <NavLink to={ROUTES.ADMIN} className={({ isActive }) => cn(styles.link, isActive && styles.active)}>
              Painel
            </NavLink>
          )}
        </nav>

        <div className={styles.actions}>
          <ThemeToggle className={styles.iconButton} />
          <Link to={ROUTES.CART} className={cn(styles.iconButton, styles.cart)} aria-label={`Carrinho${cartCount ? `, ${cartCount} item(ns)` : ''}`}>
            <Icon name="cart" />
            {cartCount > 0 && (
              <span className={styles.cartBadge} aria-hidden="true">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
          {isAuthenticated ? (
            <>
              <span className={styles.desktopOnly}>
                <NotificationBell />
              </span>
              {canAccessAdmin && (
                <Link to={ROUTES.ADMIN} className={cn(styles.iconButton, styles.mobileOnly)} aria-label="Painel administrativo">
                  <Icon name="dashboard" />
                </Link>
              )}
              <Link to={ROUTES.PROFILE} className={cn(styles.profile, styles.desktopOnly)} aria-label="Meu perfil">
                <Avatar src={profile?.avatar_url} name={profile?.full_name || profile?.username} size={36} />
              </Link>
            </>
          ) : (
            <>
              <Button to={loginTarget} variant="ghost" size="sm" className={styles.loginButton}>
                Entrar
              </Button>
              <Button to={ROUTES.REGISTER} size="sm" className={cn(styles.registerButton, styles.desktopOnly)}>
                Criar conta
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
