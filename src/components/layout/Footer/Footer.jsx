import { Link } from 'react-router'
import { useBrand } from '../../../hooks/useBrand'
import { ROUTES } from '../../../constants/routes'
import { Logo } from '../../common/Logo/Logo'
import { WaveDivider } from '../WaveDivider/WaveDivider'
import styles from './Footer.module.css'

const YEAR = new Date().getFullYear()

export function Footer() {
  const brand = useBrand()
  return (
    <footer className={styles.footer}>
      <WaveDivider color="var(--color-primary-1)" height={32} className={styles.wave} />
      <div className={styles.body}>
        <div className="container">
          <div className={styles.top}>
            <Logo tone="light" />
            <p className={styles.tagline}>{brand.tagline}</p>
          </div>
          <nav className={styles.links} aria-label="Links institucionais">
            <Link to={ROUTES.TERMS}>Termos de Uso</Link>
            <Link to={ROUTES.PRIVACY}>Política de Privacidade</Link>
          </nav>
          <p className={styles.copy}>
            © {YEAR} {brand.name}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
