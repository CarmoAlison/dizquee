import { ROUTES } from '../../../constants/routes'
import { Button } from '../../common/Button/Button'
import { EmptyState } from '../../common/EmptyState/EmptyState'

export function AccessDenied() {
  return (
    <EmptyState
      icon="shield"
      title="Acesso restrito"
      description="Você não tem permissão para ver esta área. Se acha que isso é um engano, fale com a coordenação do bloco."
      action={<Button to={ROUTES.HOME}>Voltar ao início</Button>}
    />
  )
}
