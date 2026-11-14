import { useAuth } from '../../../hooks/useAuth'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { ROUTES } from '../../../constants/routes'
import { Button } from '../../../components/common/Button/Button'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { NotificationList } from '../../../components/notifications/NotificationList/NotificationList'
import styles from './Notifications.module.css'

export default function Notifications() {
  useDocumentTitle('Notificações', { noindex: true })
  const { isAuthenticated } = useAuth()
  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>Notificações</h1>
      {isAuthenticated ? (
        <div className={styles.card}>
          <NotificationList />
        </div>
      ) : (
        <EmptyState
          icon="bell"
          title="Entre para ver suas notificações"
          description="Avisamos quando alguém curtir, comentar ou responder você."
          action={<Button to={`${ROUTES.LOGIN}?redirect=${ROUTES.NOTIFICATIONS}`}>Entrar</Button>}
        />
      )}
    </div>
  )
}
