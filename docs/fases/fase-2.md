# FASE 2 - Posts, categorias, curtidas e comentários

> **Antes de começar:** leia o `CLAUDE.md` na raiz do projeto (Prompt Mestre) e siga-o integralmente. Apresente um plano curto, implemente criando os arquivos direto no projeto, rode build/lint e, ao final, pare e aguarde minha validação.

> **Pré-requisito:** as fases anteriores já estão concluídas e testadas. Mantenha tudo que já existe funcionando.

Execute a **Fase 2**, seguindo o Prompt Mestre e mantendo tudo da Fase 1. Entregue:

- Admin: CRUD de categorias; CRUD de posts com múltiplas categorias, múltiplas fotos e vídeos, reordenação de mídia, rascunho/publicado, compressão de imagem e barra de progresso de upload.
- Home com feed em scroll infinito, chips de categorias, PostCard, carrossel de mídia, skeletons e estados vazios.
- Página de detalhe do post (/post/:slug) com título dinâmico.
- Curtidas (toggle otimista, contador em tempo real) e comentários com respostas em thread, exigindo login (modal de login para visitantes).
- Exclusão de comentário pelo autor e por quem tem a permissão.
- Compartilhamento (Web Share API, WhatsApp, copiar link) e a Vercel Function de Open Graph.
- Notificações dentro do site (curtida, comentário, resposta) com sino, contador, realtime e marcar como lida.
- Policies RLS desta fase revisadas e checklist de testes por tipo de usuário.

## Ao finalizar

- Rodar build e lint sem erros.
- Entregar passo a passo de teste, checklist de segurança/RLS desta fase, decisões tomadas e pendências.
- Parar e aguardar minha validação.
