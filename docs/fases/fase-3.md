# FASE 3 - Stories, destaques e reações

> **Antes de começar:** leia o `CLAUDE.md` na raiz do projeto (Prompt Mestre) e siga-o integralmente. Apresente um plano curto, implemente criando os arquivos direto no projeto, rode build/lint e, ao final, pare e aguarde minha validação.

> **Pré-requisito:** as fases anteriores já estão concluídas e testadas. Mantenha tudo que já existe funcionando.

Execute a **Fase 3**, seguindo o Prompt Mestre e mantendo tudo das fases anteriores. Entregue:

- Admin: criar story (imagem ou vídeo, legenda, escolha entre expirar em 24 h ou virar destaque), gerenciar destaques (coleções com título e capa), excluir, ver estatísticas.
- StoriesBar na Home com anel degradê (visto/não visto) e StoryViewer em tela cheia com barra de progresso segmentada, toque para avançar/voltar, pausa ao segurar, deslizar para fechar, suporte a teclado e vídeo.
- Curtir, comentar (com respostas) e reações rápidas nos stories, exigindo login. Convite de cadastro visível para visitantes.
- Registro de visualizações (logado e anônimo por session_id, sem duplicar) e contador/lista de quem viu para quem tem stories.view_stats.
- Rotina para expiração (filtro na consulta/RLS) e limpeza de mídia antiga (pg_cron ou Edge Function).
- Layout específico para desktop (story 9:16 centralizado) e para celular (tela cheia).
- Policies RLS desta fase revisadas e checklist de testes.

## Ao finalizar

- Rodar build e lint sem erros.
- Entregar passo a passo de teste, checklist de segurança/RLS desta fase, decisões tomadas e pendências.
- Parar e aguardar minha validação.
