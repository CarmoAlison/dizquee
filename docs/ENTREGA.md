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

---

# Entrega — Fase 6 (loja e pedidos pelo WhatsApp)

Status: build OK · lint sem erros (os mesmos 7 avisos antigos) · `npm run test:db` passa, agora com **~45 testes novos** de loja e pedidos.

> Não testado aqui: as telas rodando contra o Supabase real (a migração 0011 ainda precisa ser aplicada no seu projeto) e o envio de fotos para o bucket `product-images`.

## Preparação
1. No SQL Editor do Supabase, rode `supabase/migrations/0011_shop_orders.sql`. Ela é idempotente e pode ser rodada de novo.
2. O Super Admin já ganha as permissões novas. Para a equipe, crie perfis em Painel › Perfis de acesso, por exemplo:
   - **Loja:** `products.manage`;
   - **Atendimento:** `orders.view` + `orders.manage`;
   - **Consulta:** só `orders.view`.
3. Painel › **Config. da loja**: informe o WhatsApp do bloco, o texto de retirada e deixe a loja aberta.

## Passo a passo de teste
- [ ] Painel › Produtos › Novo: crie "Abadá" (produto) → fotos (a 1ª é a capa; reordenar e excluir) → variações P/M/G com estoque → lotes (1º lote R$ 80 até 2 un., 2º lote R$ 100) → "Mostrar na loja".
- [ ] Crie "Copo" (variação "Único" com estoque) e um **Kit** com Abadá + Copo e lote próprio.
- [ ] O aviso amarelo "Para vender, falta…" some quando o produto tem lote, estoque e itens no kit.
- [ ] **/loja**: cards com preço do lote vigente, selo do lote, "Esgotado" e "Em breve". Barra inferior com "Loja"; ícone de carrinho no header.
- [ ] Visitante clica em "Adicionar ao carrinho" → abre o modal de login sobre a página.
- [ ] Produto: escolher tamanho (sem estoque aparece riscado), quantidade limitada ao estoque, nomes de quem vai usar (se marcado no produto).
- [ ] Kit: escolher o tamanho do abadá dentro do kit.
- [ ] Carrinho: alterar quantidade, nomes, remover; total estimado; aviso se algo esgotou ou mudou de preço.
- [ ] Fazer pedido com 3 abadás quando o 1º lote tem 2 → o pedido mostra 2× R$ 80 + 1× R$ 100; o estoque baixa na hora.
- [ ] Tela "Pedido feito!" → **Enviar pelo WhatsApp** abre a conversa com o bloco, com número, itens e total.
- [ ] O sino da equipe (orders.view) avisa "fez o pedido #N" em tempo real.
- [ ] Meus pedidos (perfil, header e /pedidos): lista e detalhe com andamento; **Cancelar** enquanto aguarda pagamento (o estoque volta).
- [ ] Painel › Pedidos: cartões de resumo, busca por número/nome/telefone, filtros por status e período, paginação.
- [ ] Pedido no painel: **Chamar no WhatsApp** (cliente), **Marcar como pago** (pede a forma de pagamento), Pronto para retirada, Retirado, voltar um passo, Cancelar/Reembolsar (definitivos, devolvem estoque se ainda não retirado).
- [ ] O cliente recebe o aviso "atualizou seu pedido #N: Pago" e vê a linha do tempo, com a retirada quando pago/pronto.
- [ ] Loja fechada (Config. da loja) → o cliente vê os produtos, mas não consegue fazer pedido.
- [ ] Auditoria: áreas Produtos, Variações e estoque, Lotes, Pedidos e Configurações da loja.

## Checklist de segurança (testado em `npm run test:db`)
| Quem | Consegue | Não consegue |
|---|---|---|
| Visitante | ver o catálogo (só produtos ativos) | fazer pedido, ler pedidos |
| Cliente | fazer pedido pela RPC, ver/cancelar **os próprios** pedidos enquanto aguardam pagamento | inserir/alterar pedido direto, mudar status, mandar preço (é ignorado), ler o token do QR, ver estoque/movimentações, ver pedido de outra pessoa |
| Banido | — | fazer pedido |
| Atendimento (orders.view/manage) | ver todos os pedidos, receber aviso, mudar status | editar produtos, reabrir pedido cancelado, pular etapas |
| Loja (products.manage) | catálogo, fotos, estoque, lotes, kits, config. da loja | alterar o contador de vendidos do lote, excluir produto/variação/lote que já vendeu |

## Decisões tomadas
- **Divisão das fases:** como o pagamento é pelo WhatsApp, a gestão de pedidos no painel veio para a Fase 6 (sem ela não dá para fechar a venda). A Fase 7 fica com retirada por QR, compras de fornecedor, ajustes de estoque e venda rápida.
- **WhatsApp nos dois sentidos:** o cliente manda o pedido para o número do bloco (mensagem pronta) e a equipe tem o botão "Chamar no WhatsApp" com o número que o cliente confirmou no carrinho.
- **Lote que vira no meio do pedido:** o banco divide o item (parte em cada lote), em vez de recusar.
- **Kit:** tem preço e lotes próprios; o estoque baixa dos produtos que o compõem.
- **Estoque reservado no pedido** e devolvido ao cancelar/reembolsar antes da retirada. Reembolso depois de retirado não mexe no estoque.
- **Status:** cancelado e reembolsado são finais; entre os demais dá para voltar um passo (corrigir engano), sempre com histórico.
- **Produto/variação/lote que já vendeu não é excluído** (o certo é ocultar/desativar ou encerrar o lote), para preservar o histórico e o futuro financeiro.
- **Ajuste de estoque feito no cadastro** já gera movimentação (`stock_movements`), base para a Fase 7.
- **Conta excluída:** o pedido continua existindo (registro financeiro), sem vínculo com o usuário.
- **Carrinho no aparelho** (localStorage), sincronizado entre abas.

## Pendências
- Aplicar a 0011 no Supabase e testar as telas de verdade.
- Fase 7 (QR na retirada, estoque e venda rápida) e Fase 8 (financeiro e relatórios) aguardam sua validação.

---

# Entrega — Fase 7 (retirada com QR, estoque e venda rápida)

Status: build OK · lint sem erros (os mesmos avisos antigos) · `npm run test:db` passa, com testes novos de estoque, compras, venda rápida e retirada.

## Preparação
1. Rode `supabase/migrations/0012_pickup_stock_sales.sql` no SQL Editor (depois da 0011).
2. Perfis sugeridos:
   - **Barraca:** `sales.create` + `orders.checkin`;
   - **Retirada:** só `orders.checkin`;
   - **Estoque:** `stock.manage`.

## Passo a passo de teste
- [ ] **Compras › Nova compra:** fornecedor (digite um novo ou escolha da lista), itens com variação, quantidade e custo unitário, "A pagar" com vencimento ou "Já paga" → o estoque sobe.
- [ ] Segunda compra da mesma variação com outro custo → o custo médio em Estoque fica entre os dois.
- [ ] **Estoque:**
  - saldo, reservado (pedidos aguardando pagamento), vendido e custo médio;
  - alerta de estoque baixo (sino) e o filtro "Só estoque baixo";
  - **Ajustar** (saída ou entrada, com motivo obrigatório);
  - **Movimentações** (geral e por variação).
- [ ] **Compras:**
  - marcar paga / a pagar;
  - excluir (o estoque volta; se os itens já foram vendidos, o sistema não deixa).
- [ ] **Venda rápida:**
  - tocar nos produtos e escolher tamanho/itens do kit;
  - forma de pagamento; "Entregue na hora" ligado;
  - finalizar → o estoque baixa e o pedido aparece em Pedidos como **Retirado** (canal presencial);
  - com "Entregue na hora" desligado → fica **Pago**.
- [ ] Cliente com pedido **Pago/Pronto** → "Meus pedidos" mostra o **QR Code**. Aguardando pagamento → sem QR.
- [ ] **Retirada (QR):**
  - "Ler QR Code" (permitir a câmera) → mostra "Pode entregar" com os itens → **Confirmar retirada**;
  - ler de novo → "JÁ FOI RETIRADO em … por …";
  - pedido aguardando pagamento → "Não entregar".
- [ ] Busca manual pelo número do pedido.
- [ ] Ler o QR com a **câmera comum** do celular da equipe → abre direto a tela de retirada com o pedido (se não estiver logado, entra e volta para ela).

## Checklist de segurança (testado)
| Quem | Consegue | Não consegue |
|---|---|---|
| Cliente | ver o próprio QR (só pago/pronto) | ver o token de outra pessoa, confirmar retirada |
| Barraca (sales.create + orders.checkin) | venda rápida, ler QR, confirmar retirada | ver custos, ajustar estoque, ler a tabela de pedidos |
| Estoque (stock.manage) | compras, ajustes, custos, movimentações | — |
| Todos | — | inserir compra direto (só pela função), estoque negativo, retirar duas vezes |

## Decisões
- O QR guarda um **link** com um token secreto (nunca o número): funciona no leitor da tela e na câmera comum.
- O leitor usa o `BarcodeDetector` do navegador e cai para `jsqr` no iPhone.
- **Custo médio ponderado**, guardado numa tabela separada que nunca aparece na leitura pública das variações.
- Excluir uma compra devolve o estoque, mas não recalcula o custo médio. Para corrigir o custo, lance uma compra nova.
- A venda rápida usa o **preço do lote vigente**, vende também produtos ocultos na loja online e ignora "loja fechada".
- A venda rápida e o pedido do site usam a **mesma função interna** de itens (preço, lote, estoque).

---

# Entrega — Fase 8 (financeiro e relatórios)

Status: build OK · lint sem erros · `npm run test:db` passa (135 verificações no total), incluindo o backfill rodado de novo com dados, sem duplicar lançamentos.

## Preparação
1. Rode `supabase/migrations/0013_finance.sql` (depois da 0012). Pedidos pagos e compras que já existem entram no financeiro na hora.
2. Perfis sugeridos:
   - **Tesouraria:** `finance.manage`;
   - **Diretoria (só consulta):** `finance.view`.

## Passo a passo de teste
- [ ] **Financeiro › Visão geral:**
  - escolher o período (este mês, mês passado, 30 dias, ano ou datas livres);
  - cartões de entradas, saídas, saldo, a pagar e a receber;
  - aviso de vencidos (clicável);
  - gráfico de entradas × saídas (auto/dia/semana/mês, toque para ver valores);
  - barras por categoria (pendente hachurado);
  - **vendas por produto** com quantidade, receita, custo e **lucro**.
- [ ] Marcar um pedido como **Pago** → aparece a receita "Pedido #N (loja online)".
- [ ] **Reembolsar** → aparece a despesa "Reembolso do pedido #N".
- [ ] **Cancelar** depois de pago → a receita some.
- [ ] Venda rápida → receita "(venda presencial)".
- [ ] Nova compra → despesa "Compra de …" (a pagar/paga); marcar paga no financeiro muda a compra e vice-versa.
- [ ] **Lançamentos:**
  - nova receita (ex.: Patrocínio) ou despesa (ex.: Banda), paga ou a pagar com vencimento;
  - editar, excluir, marcar pago/recebido;
  - filtros (tipo, situação, categoria, origem, período, só vencidos).
- [ ] Lançamentos automáticos não têm editar/excluir: aparece "Automático: …" com link para o pedido ou a compra.
- [ ] **Categorias financeiras:** criar, editar nome/cor, excluir (as de sistema e as que têm lançamentos ficam protegidas).
- [ ] **Exportar** (no período escolhido):
  - **CSV** abre direto no Excel com acentos e vírgula decimal;
  - **Excel** traz as abas Resumo, Lançamentos e Vendas por produto, com formato R$;
  - **PDF** abre o relatório com logo, cores e tabelas → "Salvar PDF / Imprimir" → "Salvar como PDF".

## Checklist de segurança (testado)
| Quem | Consegue | Não consegue |
|---|---|---|
| finance.view | ver tudo e exportar | lançar, editar, marcar pago |
| finance.manage | lançar, editar e excluir manuais, marcar pago, categorias | criar lançamento "de pedido", editar automático, excluir categoria de sistema, usar categoria de receita em despesa |
| Sem permissão de financeiro (atendimento, cliente) | — | ler lançamentos, categorias ou o resumo |

## Decisões
- **Data de referência:** pago/recebido conta na data do pagamento; pendente, no vencimento.
- **Cancelado depois de pago** remove a receita (a venda não aconteceu). **Reembolsado** mantém a receita e lança o estorno, deixando o dinheiro que voltou visível.
- **Lucro por produto:** usa o custo médio **atual** das compras. Produto sem compra registrada aparece com custo "—".
- **PDF:** sai da impressão do navegador. A página do relatório é sempre clara e em formato A4.
- **Excel:** usa a biblioteca `write-excel-file`, carregada só ao exportar.

## Pendências
- Aplicar 0011, 0012 e 0013 no Supabase e testar as telas de verdade (com a câmera em HTTPS, ou seja, depois do deploy ou em localhost).
