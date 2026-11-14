// Layout do site público: header, avisos, conteúdo, rodapé, barra inferior e convite
import { Outlet } from 'react-router'
import { BottomNav } from '../BottomNav/BottomNav'
import { Footer } from '../Footer/Footer'
import { Header } from '../Header/Header'
import { SignupInvite } from '../SignupInvite/SignupInvite'
import { StatusBanners } from '../StatusBanners/StatusBanners'
import styles from './PublicLayout.module.css'

export function PublicLayout() {
  return (
    <div className={styles.layout}>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <Header />
      <StatusBanners />
      <main id="conteudo" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <SignupInvite variant="bar" />
      <BottomNav />
    </div>
  )
}
