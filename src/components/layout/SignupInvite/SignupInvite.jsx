// Convite constante para visitantes se cadastrarem.
// variant 'bar': faixa fixa e discreta acima da barra inferior (celular)
// variant 'card': cartão para laterais/fim do visualizador de stories
import { useLocation } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAuth } from '../../../hooks/useAuth'
import { cn } from '../../../utils/cn'
import { Button } from '../../common/Button/Button'
import { Logo } from '../../common/Logo/Logo'
import styles from './SignupInvite.module.css'

export function SignupInvite({ variant = 'bar', className }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (isAuthenticated || loading) return null
  const redirect = encodeURIComponent(location.pathname + location.search)

  if (variant === 'card') {
    return (
      <aside className={cn(styles.card, className)} aria-label="Convite para cadastro">
        <Logo variant="mark" size={44} />
        <h2 className={styles.cardTitle}>Faça parte do bloco!</h2>
        <p className={styles.cardText}>Crie sua conta para curtir, comentar, reagir aos stories e receber novidades.</p>
        <div className={styles.cardActions}>
          <Button to={`${ROUTES.REGISTER}?redirect=${redirect}`} fullWidth>
            Criar conta grátis
          </Button>
          <Button to={`${ROUTES.LOGIN}?redirect=${redirect}`} variant="secondary" fullWidth>
            Já tenho conta
          </Button>
        </div>
      </aside>
    )
  }

  return (
    <aside className={cn(styles.bar, className)} aria-label="Convite para cadastro">
      <p className={styles.barText}>
        <strong>Curta, comente e reaja!</strong> <span>É grátis.</span>
      </p>
      <Button to={`${ROUTES.REGISTER}?redirect=${redirect}`} size="sm" className={styles.barButton}>
        Criar conta
      </Button>
    </aside>
  )
}
