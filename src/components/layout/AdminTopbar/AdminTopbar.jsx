// Barra superior do admin: título da seção, tema e usuário
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAuth } from '../../../hooks/useAuth'
import { Avatar } from '../../common/Avatar/Avatar'
import { Logo } from '../../common/Logo/Logo'
import { ThemeToggle } from '../../common/ThemeToggle/ThemeToggle'
import styles from './AdminTopbar.module.css'

export function AdminTopbar({ roleName }) {
  const { profile } = useAuth()
  return (
    <header className={styles.topbar}>
      <Link to={ROUTES.ADMIN} className={styles.mobileBrand} aria-label="Início do painel">
        <Logo variant="mark" size={32} />
        <span>Painel</span>
      </Link>
      <div className={styles.right}>
        <ThemeToggle />
        <Link to={ROUTES.PROFILE} className={styles.user} aria-label="Meu perfil">
          <span className={styles.userText}>
            <strong>{profile?.full_name || profile?.username}</strong>
            {roleName && <span>{roleName}</span>}
          </span>
          <Avatar src={profile?.avatar_url} name={profile?.full_name || profile?.username} size={36} />
        </Link>
      </div>
    </header>
  )
}
