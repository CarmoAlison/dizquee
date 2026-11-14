# Entrega — Fases 1 a 4

Status: build OK · lint 0 erros (7 avisos do tipo "carregar dados dentro de useEffect", padrão de busca ao montar) · `npm run test:db` passa (todas as migrações + ~50 testes de RLS em Postgres local).

> O que **não** foi testado aqui: a interface rodando contra um projeto Supabase real, login com Google e SMS, Edge Functions publicadas, e-mails, Realtime e o Lighthouse. Isso depende da sua configuração (README, seção 2).

---

## Passo a passo de teste

### Preparação
1. Configure o Supabase (README §2): migrações 0001–0009, Auth (URLs, Google, SMS), Edge Functions.
2. `.env.local` com URL e anon key → `npm run dev`.
3. Cadastre-se e promova sua conta a Super Admin (README §2.2).
4. Crie uma segunda conta (cliente) em outro navegador/aba anônima.

### Fase 1 — base, autenticação e layout
- [ ] Visitante: Home abre, banner em degradê com onda, barra inferior no celular, header no desktop, convite "Criar conta" fixo (celular) e cartão lateral (desktop).
- [ ] Alternar claro/escuro (ícone lua/sol); recarregar mantém a escolha; sem escolha, segue o sistema.
- [ ] Cadastro por e-mail: nome, @usuário (mostra "Verificando…/Disponível!/já em uso" em tempo real; espaços e maiúsculas são removidos), e-mail, telefone, senha, foto com recorte (arrastar + zoom), aceite obrigatório dos termos.
- [ ] Confirmar e-mail → login → a foto escolhida no cadastro é enviada no primeiro login.
- [ ] Login com Google → como falta @usuário/telefone, cai em **Completar cadastro**.
- [ ] Login por telefone (SMS) → código de 6 dígitos → completar cadastro.
- [ ] "Esqueci minha senha" → e-mail → `/redefinir-senha` → nova senha.
- [ ] Mensagens de erro em português (senha errada, e-mail não confirmado, usuário já existe…).
- [ ] Perfil: editar nome, @usuário, telefone e foto; sair; **Excluir conta** (digitar EXCLUIR) apaga tudo.
- [ ] `/admin` como cliente → "Acesso restrito". Como Super Admin → painel.
- [ ] PWA: `npm run build && npm run preview` → Chrome mostra "Instalar app"; modo avião → páginas já vistas abrem, as não vistas mostram a página offline.

### Fase 2 — posts, categorias, curtidas, comentários, notificações
- [ ] Admin › Categorias: criar (slug automático, cor opcional), editar, reordenar (setas), excluir.
- [ ] Admin › Posts › Novo: título, texto, ≥1 categoria, várias fotos/vídeos (imagens são comprimidas; vídeo > 3 min ou > 50 MB é recusado), reordenar mídia, barra de progresso no envio, salvar como rascunho e depois publicar.
- [ ] Simular falha de envio (desligar a internet durante o upload) → mensagem clara; o post fica salvo e dá para salvar de novo.
- [ ] Home: chips de categoria rolando na horizontal, scroll infinito (crie > 8 posts), skeletons, estado vazio.
- [ ] Post: `/post/slug`, título da aba muda, carrossel (deslizar/setas/teclado), "Ver no site".
- [ ] Visitante clica em curtir/comentar → modal de login **sobre a página** (entrando ali, continua no mesmo post).
- [ ] Cliente curte → contador sobe na hora; em outra aba o contador atualiza em tempo real.
- [ ] Comentar, responder (resposta de resposta vira resposta do comentário principal, com @menção), excluir o próprio comentário.
- [ ] Admin recebe notificação (sino com número, em tempo real) de curtida/comentário; cliente recebe "respondeu seu comentário". Marcar uma / todas como lidas.
- [ ] Compartilhar: no celular abre a folha nativa (WhatsApp, Instagram…); no desktop, menu com WhatsApp e Copiar link.
- [ ] Após deploy: colar o link de um post no WhatsApp/Facebook Debugger → aparece título, resumo e foto.

### Fase 3 — stories e destaques
- [ ] Admin › Stories › Novo story: imagem ou vídeo (> 30 s recusado), legenda, "Expira em 24 h" ou "Destaque" (escolher coleção ou criar nova), progresso do envio.
- [ ] Admin › Destaques: criar com capa recortada, renomear, reordenar, excluir (os stories dele viram expirados).
- [ ] Home: círculos com anel amarelo→rosa; depois de ver, anel cinza (vale também em outro aparelho, se logado).
- [ ] Visualizador: barra segmentada; toque à direita avança, à esquerda volta; segurar pausa; arrastar para baixo fecha; ←/→/Esc/Espaço no desktop; vídeo avança ao terminar; botão de som.
- [ ] Desktop: story 9:16 centralizado com fundo escuro e setas laterais. Celular: tela cheia.
- [ ] Curtir, comentar (com respostas) e reagir com emojis; visitante vê o modal de login; ao final dos stories, visitante vê o convite de cadastro.
- [ ] Com `stories.view_stats`: ícone de olho no story mostra views (logados × visitantes), reações e lista de quem viu. Abrir o mesmo story duas vezes não duplica a view.
- [ ] Story de 24 h some do site após expirar. Limpeza: chamar a função manualmente (`curl -X POST .../functions/v1/cleanup-stories -H "x-cron-secret: ..."`).

### Fase 4 — painel completo
- [ ] Sidebar no desktop; no celular, barra inferior (Início, Posts, Stories, Menu) + gaveta. Só aparecem módulos permitidos.
- [ ] Dashboard: cards, gráfico de cadastros por dia (7/30/90 dias, tooltip ao tocar/passar), posts em alta (curtidas/comentários), stories mais vistos, atividade recente.
- [ ] Clientes: busca (nome, @, e-mail, telefone), filtros (tipo, status, período), perfil com histórico de comentários/curtidas, banir com motivo (cliente vê o aviso e não consegue interagir) e desbanir.
- [ ] Equipe: "Adicionar pessoa" (nome, e-mail, senha inicial ou "Gerar senha", perfil) cria a conta já confirmada pela Edge Function; a pessoa entra direto, completa o cadastro e pode trocar a senha em Meu perfil. Ativar/desativar, trocar perfil, remover da equipe.
- [ ] Perfis de acesso: criar "Editor" e marcar permissões por módulo; duplicar; tentar excluir perfil em uso (bloqueado); Super Admin aparece protegido.
- [ ] Comentários: buscar e excluir (posts e stories).
- [ ] Auditoria: cada ação acima aparece com autor, item e data; filtros por área, ação, texto e período.

---

## Checklist de segurança / RLS

Verificado automaticamente por `npm run test:db` (✔) ou a conferir no projeto real (☐).

### Visitante (anon)
- ✔ Lê só posts publicados (rascunho não vaza), categorias, stories ativos e destaques, comentários de posts publicados.
- ✔ Não curte, não comenta, não reage; não lê `profiles` (e-mail/telefone); só vê `public_profiles` (nome, @, foto).
- ✔ Registra view de story apenas pela função `register_story_view` (session_id anônimo, sem duplicar).
- ☐ Tentar `POST /rest/v1/post_likes` com a anon key → 401/403.

### Cliente
- ✔ Curte/comenta/reage só em nome de si mesmo; respostas limitadas a 1 nível; emoji fora da lista é recusado.
- ✔ Não altera o próprio `role_id`, `is_staff`, `is_active`, `is_banned`, e-mail, contadores nem data de aceite dos termos.
- ✔ Não cria posts/categorias/stories; não forja notificações; nas notificações só altera `read_at`.
- ✔ Não vê quem viu os stories nem métricas/auditoria.
- ✔ Exclui a própria conta (dados em cascata).
- ☐ Upload em `avatars/OUTRO-ID/...` → negado.

### Banido
- ✔ Não curte, não comenta, não reage, não edita o perfil; continua lendo o conteúdo público e vê o aviso com o motivo.

### Staff (perfil personalizado)
- ✔ Editor com `posts.create`: cria rascunho, não publica sem `posts.publish`, não edita post alheio sem `posts.edit_any`.
- ✔ Não concede a um perfil uma permissão que ele mesmo não tem (anti-escalada); não edita o próprio perfil de acesso.
- ✔ Sem `metrics.view` as RPCs do dashboard negam; sem `audit.view` o log fica vazio.
- ☐ Staff desativado (`is_active = false`) perde todas as permissões na hora (regra em `has_permission`; conferir no projeto real).
- ☐ Moderador só com `comments.delete_any`: vê e apaga comentários, mas não acessa posts/clientes.

### Super Admin
- ✔ Perfil de sistema não pode ser editado por ninguém; ninguém altera o próprio perfil de acesso.
- ☐ Só Super Admin atribui/remove o perfil de sistema; Super Admin não pode ser banido; o último Super Admin não consegue excluir a própria conta (regras no banco, conferir no projeto real).

### Storage e funções
- ☐ Buckets com limite de tamanho e tipos MIME; escrita só com permissão (ou na própria pasta, em avatars) — conferir no projeto real.
- ☐ Edge Function `create-staff-user` valida JWT + `staff.create` e só Super Admin atribui perfil de sistema (testar chamando sem permissão → 403).
- ☐ `cleanup-stories` exige `x-cron-secret` (testar sem o header → 401); a função SQL de limpeza só é executável pela service role.
- ✔ (revisão de código) `service_role` não existe no front-end; texto de usuário é sempre renderizado como texto (sem `dangerouslySetInnerHTML`); `?redirect=` só aceita caminhos internos.

---

## Decisões tomadas
1. **Fases 1–4 feitas de uma vez**, a pedido, em vez de parar entre fases.
2. **Nome provisório "Bloco Diz Que É"** (vem do nome da pasta) em `src/constants/brand.js`, no manifest e na função de OG.
3. **E-mail e telefone não são públicos:** `profiles` só é lido pelo dono e por staff com permissão; autores aparecem pela view `public_profiles`.
4. **Curtidas e reações:** o público vê os contadores; quem curtiu/reagiu só é visível ao próprio usuário e a quem tem `users.view_history`/`stories.view_stats`.
5. **Perfil de sistema = todas as permissões** automaticamente (inclusive as que forem criadas no futuro).
6. **Anti-escalada:** só dá para conceder permissões que você mesmo tem.
7. **Publicar exige `posts.publish`**; quem só tem `posts.create` edita o próprio post enquanto é rascunho.
8. **Post precisa de pelo menos 1 categoria.** Data de publicação futura agenda o post.
9. **Imagens de post em JPEG** (melhor preview no WhatsApp/Facebook); stories e avatares em WebP. Máx. 1600 px (stories 1920 px).
10. **srcset só com Image Transformations** do Supabase (plano Pro) — flag `VITE_SUPABASE_IMAGE_TRANSFORM`.
11. **Validade dos stories definida pelo servidor** (24 h); destaque não expira. Excluir um destaque não apaga os stories: eles viram expirados.
12. **Stories expirados ficam 30 dias** (para estatísticas) antes da limpeza (`STORY_RETENTION_DAYS`).
13. **Reação:** uma por emoji por pessoa (toggle); notificação de reação agrupada por pessoa/story.
14. **Descurtir apaga a notificação** de curtida (evita spam).
15. **Resposta de resposta** vira resposta do comentário raiz com @menção (1 nível no banco).
16. **Telefone obrigatório** no cadastro e no "completar cadastro"; normalizado para +55 quando só tem DDD.
17. **Foto do cadastro** com confirmação de e-mail pendente fica salva no navegador e é enviada no primeiro login.
18. **Equipe criada sem confirmação de e-mail:** a conta nasce confirmada com a senha definida no painel; se o e-mail já tem conta, ela é promovida (senha mantida). "Remover da equipe" mantém a conta como cliente.
19. **Termos versionados** (`TERMS_VERSION`): mudar a versão pede novo aceite a todos.
20. **Aba "Stories"** na barra inferior (no lugar de "Buscar"), com stories de agora e destaques.
21. **PWA:** `display_override: fullscreen`; páginas em cache "rede primeiro"; página offline simples; handlers de push já no service worker.
22. Bibliotecas extras: `react-router` (rotas), `@supabase/supabase-js`, `date-fns` (datas em pt-BR, modular), `browser-image-compression` (compressão em Web Worker + orientação EXIF), `vite-plugin-pwa` + `workbox-*` (service worker); dev: `@electric-sql/pglite` (teste local do banco). As Edge Functions são em TypeScript porque é o padrão do runtime Deno do Supabase.

## Pendências / o que depende de você
- Configurar Supabase (Auth, Google, provedor de SMS, SMTP), publicar as Edge Functions e agendar a limpeza (README §2).
- Enviar logo, fontes e ícones definitivos; revisar o nome do bloco.
- Revisar os textos-modelo de **Termos** e **Privacidade** (contato/DPO entre colchetes).
- Traduzir os templates de e-mail no Supabase.
- Rodar o **Lighthouse** após o deploy (não medido aqui). Já aplicado: páginas carregadas sob demanda, imagens lazy com dimensões, vídeos com `preload` mínimo, cache do service worker.
- Testes no aparelho real (iOS/Android) do visualizador de stories e da instalação do PWA.
- Fora do escopo (arquitetura pronta): agenda, loja/pagamentos, galeria, patrocinadores, carteirinha, denúncias e filtro de palavrões, push (Fase 5).
