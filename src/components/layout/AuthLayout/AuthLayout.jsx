// Moldura das páginas de autenticação: faixa em degradê com onda + cartão
import { Logo } from '../../common/Logo/Logo'
import { WaveDivider } from '../WaveDivider/WaveDivider'
import styles from './AuthLayout.module.css'

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className={styles.page}>
      <div className={styles.banner}>
        <Logo tone="light" size={48} className={styles.logo} />
        <WaveDivider color="var(--color-bg)" height={56} className={styles.wave} />
      </div>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        <div className={styles.content}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}
