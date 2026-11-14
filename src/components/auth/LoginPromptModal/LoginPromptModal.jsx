// Modal para visitantes que tentam curtir/comentar/reagir: entra ali mesmo,
// sem sair da página (ou vai para o cadastro e volta depois).
import { Link, useLocation } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { Logo } from '../../common/Logo/Logo'
import { Modal } from '../../common/Modal/Modal'
import { LoginForm } from '../LoginForm/LoginForm'
import styles from './LoginPromptModal.module.css'

export function LoginPromptModal({ open, reason, onClose }) {
  const location = useLocation()
  const here = location.pathname + location.search
  return (
    <Modal open={open} onClose={onClose} title="Entre para participar" size="sm">
      <div className={styles.intro}>
        <Logo variant="mark" size={40} />
        <p>{reason}</p>
      </div>
      <LoginForm redirectPath={here} onSuccess={onClose} />
      <p className={styles.register}>
        Ainda não tem conta?{' '}
        <Link to={`${ROUTES.REGISTER}?redirect=${encodeURIComponent(here)}`} onClick={onClose}>
          Cadastre-se grátis
        </Link>
      </p>
    </Modal>
  )
}
