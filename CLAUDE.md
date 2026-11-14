# Prompt Mestre - Site e sistema do Bloco de Carnaval

> Este arquivo é o **CLAUDE.md** do projeto: o Claude Code o lê automaticamente. Ele vale para todas as fases. As tarefas de cada fase estão em arquivos separados (docs/fases/fase-1.md a fase-5.md).

## 1. Seu papel e o objetivo

Você é um desenvolvedor full-stack sênior, especialista em React, Supabase (PostgreSQL, Auth, Storage, RLS, Edge Functions), design responsivo mobile-first e PWA. Vou pedir a construção de um site/sistema para um **bloco de carnaval**, em fases. Siga rigorosamente as especificações abaixo. Se algo estiver ambíguo, escolha a opção mais simples e segura, e registre a decisão no final da resposta. Não invente funcionalidades fora do escopo.

## 2. Escopo

**Dentro do escopo agora:** autenticação, perfis e permissões, posts, categorias, stories, destaques, curtidas, comentários, reações, notificações dentro do site, painel admin, métricas, PWA, compartilhamento.

**Fora do escopo agora (não implementar, mas deixar a arquitetura preparada):**

- Página de agenda/eventos/ensaios/desfiles
- Loja (abadá, copo, camisas) e pagamentos. No futuro será tudo comprado pelo sistema, então não crie nada que impeça essa evolução (ex.: mantenha a estrutura de pastas e de permissões extensível por módulo)
- Galeria de desfiles, área de patrocinadores, carteirinha digital com QR Code (ideias para depois)
- Denúncia de comentários e filtro de palavrões (o admin apaga manualmente quando precisar)

## 3. Stack e padrões técnicos

- **Vite + React** (JavaScript). TypeScript somente se for realmente necessário em algo específico, e avise quando usar.
- **React Router** para rotas (rotas públicas, protegidas e de admin).
- **CSS puro com CSS Modules** (um arquivo .module.css por componente/página) + variáveis CSS globais para o tema. Proibido usar Tailwind, Bootstrap, styled-components ou bibliotecas de UI.
- **Supabase:** Auth, PostgreSQL com RLS, Storage, Realtime (notificações e contadores) e Edge Functions onde for necessário usar a service role.
- Bibliotecas JS auxiliares são permitidas quando realmente ajudarem (ex.: vite-plugin-pwa, browser-image-compression, date-fns). Justifique cada uma.
- **Hospedagem na Vercel:** inclua vercel.json com rewrite de SPA e explique as variáveis de ambiente (.env.example).
- Nunca exponha a service role key no front-end. Use apenas a anon key no cliente.

## 4. Identidade visual

Use exatamente estas cores como variáveis CSS (em src/styles/variables.css):

```
--color-primary-1: #660385;   /* predominante 01 */
--color-primary-2: #AB00B3;   /* predominante 02 */
--color-accent-1:  #FF0096;   /* destaque 01 (curtir, botões de ação, notificações) */
--color-accent-2:  #FDCB26;   /* destaque 02 (anel de story, selos, destaques) */
```

- Use **degradês** entre as duas cores predominantes (ex.: linear-gradient(135deg, #660385, #AB00B3)) em cabeçalhos, banners e botões principais, e crie **divisores em formato de onda** (SVG inline ou clip-path) entre seções, sem exagero.
- As cores de destaque entram em detalhes: anel dos stories (degradê #FDCB26 para #FF0096), botão de curtir, badges, estados ativos.
- Crie **modo claro e modo escuro** via variáveis CSS (data-theme no html), com troca manual e respeito ao prefers-color-scheme. Garanta contraste mínimo AA.
- Eu vou fornecer o logo e a identidade visual (fontes e demais elementos). Deixe um local fixo (src/assets/brand/) e um componente Logo para substituir facilmente. Até lá, use placeholders.
- Visual moderno: cantos arredondados, sombras suaves, microanimações discretas (respeitando prefers-reduced-motion), tipografia legível.

## 5. Perfis de usuário e regras de acesso

- **Visitante (sem login):** vê posts, categorias e stories. Em toda a interface deve aparecer, de forma discreta e constante, um convite para se cadastrar/entrar (banner, card ou botão fixo). Ao tentar curtir, comentar ou reagir, abrir um modal pedindo login/cadastro, sem perder o contexto da página.
- **Cliente (logado):** tudo do visitante + curtir, comentar, responder comentários, reagir a stories, editar o próprio perfil, ver notificações e excluir os próprios comentários.
- **Equipe interna (staff):** acessa o painel admin conforme o perfil de acesso (role) atribuído.
- **Super Admin:** role de sistema com todas as permissões, que não pode ser removida nem editada por outros.

**Sistema de permissões 100% personalizável e detalhado.** Nada de campo fixo "is_admin". Use as tabelas roles, permissions e role_permissions. O Super Admin cria perfis (ex.: Editor, Moderador, Social Media) e marca quais permissões cada um tem, por módulo e por ação. Permissões mínimas a prever:

```
posts.view_admin | posts.create | posts.edit_own | posts.edit_any
posts.delete_own  | posts.delete_any | posts.publish
categories.create | categories.edit | categories.delete
stories.create | stories.delete_own | stories.delete_any
stories.manage_highlights | stories.view_stats
comments.delete_any
users.view | users.view_history | users.ban | users.unban
staff.create | staff.edit | staff.delete
roles.view | roles.manage
metrics.view | audit.view | settings.manage
```

- Crie a função SQL has_permission(permission_key text) (SECURITY DEFINER) e use em todas as policies de RLS.
- No front-end, crie o hook usePermission() e o componente PermissionGate para esconder/mostrar botões e rotas. **Isso é só UX: a segurança real é no banco (RLS).**
- O menu do admin deve mostrar apenas os módulos que o usuário tem permissão de ver.

## 6. Autenticação e cadastro

- Login por **e-mail e senha**, **Google** e **telefone (código OTP por SMS)**, todos via Supabase Auth. Explique a configuração necessária de cada provedor no painel do Supabase (Google Cloud OAuth, provedor de SMS).
- **Campos do cadastro:** nome, nome de usuário **único** (validação em tempo real, sem espaços, minúsculo), e-mail, senha, telefone e foto de perfil (opcional no upload, com recorte/redimensionamento).
- Quem entra por Google ou telefone e ainda não tem perfil completo deve passar por uma etapa obrigatória de **completar cadastro** (usuário único, telefone, termos).
- **LGPD:** checkbox obrigatório de aceite dos Termos de Uso e da Política de Privacidade no cadastro, com páginas /termos e /privacidade (texto-modelo editável) e registro de data/hora e versão do aceite em profiles.
- Recuperação de senha por e-mail, confirmação de e-mail, mensagens de erro claras em português.
- Usuário banido: bloquear acesso às ações de interação (via RLS) e mostrar aviso claro na interface.
- Direito do titular: tela no perfil para o usuário excluir a própria conta e seus dados.

## 7. Posts e categorias

- Post tem: título, texto (conteúdo), uma ou mais categorias, **várias fotos e vídeos** (carrossel com ordem definida), status (rascunho/publicado), data de publicação e autor.
- Limites configuráveis em src/constants/mediaLimits.js: imagens comprimidas e redimensionadas no navegador antes do upload (ex.: máx. 1600 px no maior lado, formato WebP/JPEG); vídeos de post com duração e tamanho máximos maiores que os dos stories (valores na seção 19).
- **Categorias:** existe uma página no admin só para criar, editar, ordenar e excluir categorias (nome, slug, descrição, cor opcional). Um post pode ter várias categorias. Na Home, filtros por categoria em chips rolando na horizontal.
- Feed com **scroll infinito** (paginação por cursor), lazy loading de imagens/vídeos e skeletons.
- Página de detalhe do post com slug amigável, carrossel de mídia, curtidas, comentários e botão de compartilhar.

## 8. Stories (estilo Instagram)

- Barra de stories no topo da Home (círculos com anel degradê #FDCB26 para #FF0096; anel cinza quando já visto) e **visualizador em tela cheia**.
- Mídia: imagem ou vídeo. Vídeo de story com duração máxima curta (valor em mediaLimits.js).
- Visualizador: **barra de progresso** segmentada, toque na esquerda volta e toque na direita avança, segurar para pausar, deslizar para baixo fecha, setas/Esc no desktop, vídeo avança ao terminar.
- **Validade:** ao criar, o admin escolhe: expira em 24 h **ou** fica como **destaque** (permanente, agrupado em coleções de destaques com título e capa, como no Instagram). Stories expirados e não destacados deixam de aparecer (filtro por expires_at na RLS/consulta); prever rotina (pg_cron ou Edge Function) para limpar mídia antiga.
- **Interação:** curtir, comentar (com respostas) e **reações rápidas** com emojis (fogo, coração, palmas e mais algumas; renderizar como emoji na tela). Exigem login.
- **Visualizações:** registrar views e mostrar o contador (e a lista de quem viu, quando logado) para quem tem a permissão stories.view_stats.
- Para visitantes, os stories são visíveis, e ao final do visualizador/ao interagir aparece o convite para cadastro.

## 9. Comentários, curtidas, reações e notificações

- Comentários **aparecem direto** (sem moderação prévia). Quem tem comments.delete_any pode apagar qualquer comentário; o autor pode apagar o próprio.
- **Respostas em thread** (parent_id), com limite de profundidade de 1 nível para manter simples no celular.
- Curtida é um toggle (uma por usuário por item), com atualização otimista e contador em tempo real.
- **Notificações dentro do site** (sino com contador): alguém curtiu, comentou ou respondeu. Use Supabase Realtime e tabela notifications. Marcar como lida individualmente e em massa.
- Push no celular fica para a Fase 5 (opcional), mas deixe o service worker do PWA já preparado.

## 10. Painel admin

- Rotas em /admin com layout próprio: **sidebar no desktop** e **menu inferior/gaveta no celular**. Tudo precisa ser operável no celular.
- **Dashboard/métricas:** novos cadastros por dia, total de usuários, posts mais curtidos e comentados, stories mais vistos, atividade recente. Gráficos simples em SVG/CSS puro ou biblioteca leve.
- **Posts:** listar, criar, editar, publicar/despublicar, excluir, filtrar por categoria e status.
- **Categorias:** CRUD completo.
- **Stories e destaques:** criar (24 h ou destaque), editar destaques, excluir, ver estatísticas.
- **Clientes:** lista com busca e filtros (data de cadastro, status), **ver quem se cadastrou e quando**, abrir perfil com **histórico de curtidas e comentários**, **banir e desbanir** (com motivo e data).
- **Equipe interna:** criar usuários internos (e-mail, nome, perfil de acesso), ativar/desativar, trocar perfil. A criação deve ser feita por uma **Edge Function** que usa a service role, validando a permissão staff.create do chamador.
- **Perfis de acesso (roles):** criar, editar, duplicar e excluir perfis, com matriz de permissões agrupadas por módulo (checkboxes). Perfis de sistema ficam protegidos.
- **Comentários:** tela para localizar e excluir comentários.
- **Log de auditoria:** registrar quem fez o quê (criou/editou/excluiu post, baniu usuário, alterou permissões) em audit_logs, visível para quem tem audit.view.

## 11. Banco de dados Supabase (gerar todo o SQL)

Entregue o SQL em **arquivos de migração numerados** em supabase/migrations/ (ex.: 0001_extensions_enums.sql, 0002_tables.sql, 0003_functions_triggers.sql, 0004_rls.sql, 0005_storage.sql, 0006_seed.sql), prontos para colar no SQL Editor do Supabase, idempotentes quando possível e comentados em português. Tabelas previstas:

```
profiles            (id = auth.users.id, full_name, username UNIQUE, phone, avatar_url,
                     role_id NULL, is_staff, is_banned, banned_at, banned_reason,
                     terms_accepted_at, terms_version, created_at)
roles               (id, name, description, is_system, created_at)
permissions         (id, key UNIQUE, module, description)
role_permissions    (role_id, permission_id)
categories          (id, name, slug UNIQUE, description, color, position)
posts               (id, title, slug UNIQUE, content, author_id, status,
                     published_at, created_at, updated_at)
post_categories     (post_id, category_id)
post_media          (id, post_id, type, storage_path, position, width, height, duration)
post_likes          (post_id, user_id, created_at)
comments            (id, post_id, parent_id, user_id, content, created_at)
highlights          (id, title, cover_path, position, created_at)
stories             (id, author_id, media_type, storage_path, caption, expires_at,
                     is_highlight, highlight_id NULL, created_at)
story_views         (id, story_id, viewer_id NULL, session_id, viewed_at)
story_likes         (story_id, user_id, created_at)
story_reactions     (story_id, user_id, emoji, created_at)
story_comments      (id, story_id, parent_id, user_id, content, created_at)
notifications       (id, user_id, type, actor_id, post_id, story_id, comment_id,
                     read_at, created_at)
audit_logs          (id, actor_id, action, entity, entity_id, metadata jsonb, created_at)
push_subscriptions  (id, user_id, endpoint, keys jsonb, created_at)  -- Fase 5
```

- Trigger que cria o profile automaticamente quando um usuário é criado em auth.users.
- Triggers para gerar notificações (curtida, comentário, resposta) e para manter contadores/atualizar updated_at.
- Índices em chaves estrangeiras, slugs, created_at e expires_at. Views/RPCs para contadores e métricas (evitar contar no front).
- Seed: permissões, role Super Admin com todas as permissões e instrução de como promover o primeiro usuário a Super Admin.

## 12. Segurança (RLS obrigatório)

- **Habilitar RLS em todas as tabelas.** Nenhuma tabela pode ficar aberta.
- Leitura pública (anon) apenas de: posts publicados, categorias, stories ativos (não expirados ou destaques), destaques, contadores e comentários/curtidas visíveis.
- Inserir/alterar curtidas, comentários, reações e perfil próprio: somente usuário autenticado, não banido (auth.uid() = user_id).
- Ações administrativas: sempre com has_permission('...') nas policies. O usuário não pode alterar o próprio role_id nem is_banned.
- Edge Functions para operações que exigem service role (criar usuário da equipe, ações sensíveis), validando o JWT e a permissão do chamador.
- Validar dados também no banco (CHECK, UNIQUE, NOT NULL, tamanhos) e sanitizar texto exibido (sem dangerouslySetInnerHTML com conteúdo de usuário).
- Ao final de cada fase, entregue uma **lista de testes de segurança**: o que um visitante, um cliente, um banido e cada perfil de staff conseguem e não conseguem fazer.

## 13. Storage

- Buckets: avatars, post-media, story-media, highlight-covers, brand (público para leitura quando fizer sentido).
- Policies de Storage: leitura pública; upload/exclusão somente por usuários autenticados com permissão (ou, em avatars, apenas na própria pasta).
- Caminhos organizados (ex.: posts/{post_id}/{uuid}.webp). Informar limites de tamanho por arquivo e lembrar dos limites do plano do Supabase.
- Compressão/redimensionamento de imagem no cliente antes do upload, barra de progresso de upload e tratamento de falha.

## 14. Responsividade e UX

- **Mobile-first:** escrever o CSS base para celular e ampliar com media queries (sugestão: 480, 768, 1024, 1280 px).
- Celular: navegação por **barra inferior** (Início, Stories/Buscar, Notificações, Perfil), áreas de toque de no mínimo 44x44 px, suporte a safe-area (notch), sem scroll horizontal indesejado.
- Desktop: header superior com navegação, conteúdo centralizado com largura máxima, feed em coluna central com lateral opcional, visualizador de story em formato 9:16 centralizado sobre fundo escurecido.
- Imagens responsivas (srcset/sizes quando possível), proporções fixas para evitar salto de layout.
- Estados de carregamento (skeletons), **estados vazios** e **mensagens de erro** amigáveis em todas as telas. Toasts para feedback de ações.
- **Acessibilidade:** contraste AA, alt em imagens, foco visível, navegação por teclado no desktop, aria-labels em ícones, modais com foco preso.
- Textos da interface em **português do Brasil**.

## 15. PWA, compartilhamento e SEO

- **PWA instalável** (vite-plugin-pwa): manifest com nome, ícones, cores (theme_color #660385), abertura em tela cheia, service worker com cache de assets e página offline simples.
- **Compartilhar post:** botão que usa a Web Share API (no celular abre a folha de compartilhamento, incluindo WhatsApp e Instagram), com opções diretas de WhatsApp e copiar link como alternativa. Observação técnica: o Instagram não possui link de compartilhamento web para o feed; a Web Share API é o caminho possível no navegador.
- **Preview bonito (Open Graph/Twitter Card):** como o site é SPA, crie uma Vercel Function (ex.: api/share/[slug]) que devolve HTML com as meta tags og:title, og:description e og:image do post para os robôs (WhatsApp, Instagram, Facebook) e redireciona as pessoas para a rota normal.
- Meta tags básicas, favicon, título dinâmico por página.

## 16. Estrutura de pastas (organização é prioridade)

Mantenha tudo organizado por responsabilidade, com nomes específicos e consistentes (componentes em PascalCase, um componente por pasta com seu .jsx e seu .module.css; hooks começando com use; serviços por domínio):

```
src/
  assets/        brand/ icons/ images/
  components/
    common/      Button Input Modal Avatar Skeleton EmptyState Toast Loader
    layout/      Header BottomNav Footer WaveDivider AdminSidebar AdminTopbar
    auth/        LoginForm RegisterForm SocialButtons PhoneOtpForm
                 ProtectedRoute PermissionGate LoginPromptModal
    posts/       PostCard PostList PostForm PostMediaCarousel CategoryChips
    stories/     StoriesBar StoryViewer StoryProgress StoryUploader ReactionPicker
    comments/    CommentList CommentItem CommentForm
    notifications/ NotificationBell NotificationList
  pages/
    public/      Home PostDetails Login Register CompleteProfile Profile
                 Terms Privacy NotFound
    admin/       Dashboard Posts Categories Stories Highlights Users
                 Staff Roles Comments AuditLogs
  contexts/      AuthContext ThemeContext PermissionContext
  hooks/         useAuth usePermission usePosts useStories useInfiniteScroll
  services/      supabaseClient postsService storiesService authService ...
  routes/        AppRoutes PublicRoutes AdminRoutes
  styles/        variables.css global.css themes.css reset.css
  utils/         formatDate slugify imageCompression validators
  constants/     mediaLimits permissions routes
supabase/
  migrations/    0001_... .sql
  functions/     create-staff-user/
api/             share/[slug].js          (Vercel Function, Open Graph)
public/          icons/ manifest assets
```

## 17. Qualidade de código

- Código limpo, comentado em português quando necessário, componentes pequenos e reutilizáveis, sem duplicação.
- Separar UI de acesso a dados: nada de chamadas ao Supabase direto dentro de componentes visuais, use a pasta services e hooks.
- Tratamento de erros e estados de loading em toda chamada assíncrona.
- Usar variáveis de ambiente (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) e fornecer .env.example.
- Fornecer README com instruções de instalação, configuração do Supabase, deploy na Vercel e como criar o primeiro Super Admin.

## 18. Como você deve trabalhar em cada fase (Claude Code)

- Antes de codar, leia o arquivo da fase que eu indicar e este CLAUDE.md inteiro. Apresente um **plano curto** (arquivos que vai criar/alterar e ordem) e só então implemente.
- **Crie e edite os arquivos diretamente no projeto.** Não cole código no chat. Código completo e funcional, sem "...resto do código aqui".
- Crie o SQL da fase em arquivos de migração separados em supabase/migrations/.
- Trabalhe **somente na fase pedida**. Não adiante funcionalidades das próximas fases (exceto as tabelas do banco, que já nascem completas na Fase 1).
- Rode o build e o lint ao terminar e corrija os erros. Se algo não puder ser testado por depender de configuração externa (Supabase, Google, SMS), diga exatamente o que eu preciso configurar.
- Ao finalizar, entregue: (a) passo a passo para rodar e testar, (b) checklist de testes de segurança/RLS da fase, (c) decisões que você tomou, (d) o que ficou pendente. Depois **pare e aguarde minha validação** antes da próxima fase.

## 19. Decisões já tomadas (siga, a menos que eu diga o contrário)

- **Duração dos vídeos:** stories de até 30 segundos e vídeos de post de até 3 minutos. Tudo em src/constants/mediaLimits.js, fácil de mudar.
- **Tamanho de arquivo:** o plano gratuito do Supabase limita o tamanho por arquivo (50 MB). Vídeo de post de até cerca de 50 MB, com orientação ao admin para comprimir antes de subir.
- **Respostas em comentários:** um único nível de resposta.
- **Login por telefone:** OTP por SMS (exige provedor de SMS configurado no Supabase, que pode ter custo). Código por WhatsApp depende do provedor escolhido.
- **Perfis iniciais:** só o Super Admin vem pronto no seed. Os demais perfis são criados por mim no painel.
- **Visualizações de story de visitantes:** contam por session_id anônimo, sem identificar a pessoa.
- **Push:** fica na Fase 5 (opcional). Até lá, as notificações existem só dentro do site.
