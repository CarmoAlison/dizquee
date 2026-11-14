import { getErrorMessage } from '../../../utils/errors'
import { Button } from '../Button/Button'
import { EmptyState } from '../EmptyState/EmptyState'

/** Mensagem de erro amigável com botão "Tentar de novo" */
export function ErrorState({ error, onRetry, title = 'Não foi possível carregar', compact }) {
  return (
    <EmptyState
      tone="error"
      compact={compact}
      title={title}
      description={getErrorMessage(error, 'Verifique sua conexão e tente novamente.')}
      action={
        onRetry && (
          <Button variant="secondary" icon="refresh" onClick={onRetry}>
            Tentar de novo
          </Button>
        )
      }
    />
  )
}
