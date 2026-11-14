import { ROUTES } from '../../../constants/routes'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { Button } from '../../../components/common/Button/Button'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'

export default function NotFound() {
  useDocumentTitle('Página não encontrada', { noindex: true })
  return (
    <div className="container">
      <EmptyState
        icon="search"
        title="Página não encontrada"
        description="O endereço pode estar errado ou a página foi removida."
        action={<Button to={ROUTES.HOME}>Voltar ao início</Button>}
      />
    </div>
  )
}
