// Aviso exibido quando o .env do Supabase ainda não foi configurado
import { EmptyState } from '../EmptyState/EmptyState'

export function SetupNotice() {
  return (
    <main className="container">
      <EmptyState
        icon="alert"
        title="Configuração pendente"
        description="Crie o arquivo .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example e o README) e reinicie o servidor."
      />
    </main>
  )
}
