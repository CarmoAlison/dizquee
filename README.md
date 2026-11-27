# Bloco Diz Que É — site e sistema

Site/PWA do bloco de carnaval: feed de posts com fotos e vídeos, stories (24 h e destaques), curtidas, comentários com respostas, reações, notificações dentro do site e painel administrativo com permissões personalizáveis.

**Stack:** Vite + React (JavaScript) · React Router · CSS Modules + variáveis CSS · Supabase (Auth, Postgres + RLS, Storage, Realtime, Edge Functions) · Vercel.

> Regras do projeto: [CLAUDE.md](CLAUDE.md). Tarefas por fase: [docs/fases/](docs/fases/). Entrega, testes e checklists: [docs/ENTREGA.md](docs/ENTREGA.md).

---

## 1. Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha com os dados do Supabase
npm run dev                  # http://localhost:5173
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção (gera `dist/` + service worker) |
| `npm run preview` | serve o build localmente (teste do PWA) |
| `npm run lint` | oxlint |
| `npm run test:db` | roda as migrações num Postgres local (PGlite) e testa RLS/permissões |

### Variáveis de ambiente (`.env.local` e Vercel)

| Variável | Onde pegar |
|---|---|
| `VITE_SUPABASE_URL` | Supabase › Project Settings › API › Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase › Project Settings › API › `anon` `public` |
| `VITE_SITE_URL` | URL pública do site (ex.: `https://blocodizquee.com.br`) |
| `VITE_SUPABASE_IMAGE_TRANSFORM` | `true` só se o projeto tiver Image Transformations (plano Pro) |

**Nunca** coloque a `service_role` no front-end nem na Vercel. Ela só existe dentro das Edge Functions (o Supabase injeta automaticamente).

---

## 2. Configurar o Supabase

### 2.1 Banco (migrações)
No **SQL Editor**, rode **em ordem** os arquivos de `supabase/migrations/`:

| Arquivo | Conteúdo |
|---|---|
| `0001_extensions_enums.sql` | extensões e tipos |
| `0002_tables.sql` | todas as tabelas (de todas as fases), validações e índices |
| `0003_functions_triggers.sql` | `has_permission`, criação automática do profile, proteção de campos, exclusão de conta, view pública de perfis |
| `0004_rls.sql` | RLS de todas as tabelas |
| `0005_storage.sql` | buckets e policies do Storage |
| `0006_seed.sql` | permissões + perfil Super Admin |
| `0007_posts_comments_notifications.sql` | Fase 2: contadores, respostas, notificações, feed, realtime |
| `0008_stories.sql` | Fase 3: stories, views, reações, estatísticas, limpeza |
| `0009_admin_audit_metrics.sql` | Fase 4: auditoria automática e métricas do dashboard |
| `0010_brand_settings.sql` | Identidade visual editável pelo painel (nome, logo, cores) |
| `0011_shop_orders.sql` | Fase 6: loja (produtos, variações, estoque, lotes, kits), pedidos, bucket `product-images` |
| `0012_pickup_stock_sales.sql` | Fase 7: retirada com QR Code, fornecedores, compras com custo, ajustes de estoque, venda rápida |
| `0013_finance.sql` | Fase 8: financeiro (categorias, lançamentos, automáticos de pedidos/compras, relatórios) |

Todos são idempotentes (podem ser rodados de novo). Com a Supabase CLI: `supabase db push`.

### 2.2 Criar o primeiro Super Admin
1. Cadastre-se no site e confirme o e-mail.
2. No SQL Editor:
   ```sql
   update public.profiles
      set is_staff = true, is_active = true,
          role_id = (select id from public.roles where name = 'Super Admin')
    where email = 'seu-email@exemplo.com';
   ```
3. Saia e entre de novo: aparece **Painel** no menu. Os outros perfis (Editor, Moderador…) você cria em **Painel › Perfis de acesso**.

### 2.3 Authentication
- **URL Configuration:** *Site URL* = URL do site. Em *Redirect URLs*, adicione `http://localhost:5173/**` e `https://SEU-DOMINIO/**`.
- **E-mail:** deixe *Confirm email* ligado. Em *Email Templates*, traduza os textos (confirmação, recuperação, convite) para português. Para volume real, configure um SMTP próprio (o SMTP padrão do Supabase tem limite baixo de envios por hora).
- **Google:**
  1. [Google Cloud Console](https://console.cloud.google.com/) › APIs e serviços › *Tela de consentimento OAuth* (tipo Externo, nome do bloco, e-mail de suporte, domínio).
  2. *Credenciais* › *Criar credenciais* › *ID do cliente OAuth* › *Aplicativo da Web*.
  3. *URIs de redirecionamento autorizados*: `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
  4. Copie *Client ID* e *Client Secret* para Supabase › Authentication › Providers › Google e ative.
- **Telefone (SMS):** Authentication › Providers › Phone › ative e escolha um provedor (Twilio, MessageBird, Vonage ou Textlocal). No Twilio: *Account SID*, *Auth Token* e *Messaging Service SID* (ou *Twilio Verify*). **Cada SMS é cobrado pelo provedor.** Código por WhatsApp é possível com Twilio Verify (canal WhatsApp), com custo e aprovação própria.

Quem entra por Google ou telefone passa pela etapa **Completar cadastro** (usuário único, telefone e aceite dos termos).

### 2.4 Storage
Os buckets são criados pela migração 0005 (`avatars`, `post-media`, `story-media`, `highlight-covers`, `brand`) e pela 0011 (`product-images`, até 5 MB), todos públicos para leitura. Limites por arquivo: avatar 2 MB, post 50 MB, story 30 MB, capa 2 MB. No plano gratuito o máximo por arquivo é **50 MB** (Storage › Settings) e o total de armazenamento é limitado — oriente a equipe a comprimir vídeos antes de subir.

### 2.5 Edge Functions
Com a [Supabase CLI](https://supabase.com/docs/guides/cli):
```bash
supabase login
supabase link --project-ref SEU-PROJECT-REF
supabase functions deploy create-staff-user

supabase secrets set CRON_SECRET=um-segredo-longo STORY_RETENTION_DAYS=30
supabase functions deploy cleanup-stories --no-verify-jwt
```
- `create-staff-user`: cria usuários da equipe com a service role, validando o JWT e a permissão `staff.create` de quem chama. A conta já nasce **confirmada** (sem e-mail de confirmação), com a senha definida no painel; a pessoa pode trocá-la em *Meu perfil › Trocar senha*.
- `cleanup-stories`: apaga arquivos e registros de stories expirados (não destaque) há mais de `STORY_RETENTION_DAYS` dias.

**Agendar a limpeza (diária):** ative as extensões `pg_cron` e `pg_net` (Database › Extensions) e rode o bloco comentado no final de `0008_stories.sql`, trocando `<PROJECT_REF>` e `<CRON_SECRET>`.

### 2.6 Realtime
As migrações já adicionam `posts`, `stories` e `notifications` à publicação `supabase_realtime` (contadores e sino em tempo real). Confira em Database › Publications.

---

## 3. Deploy na Vercel
1. Suba o projeto para um repositório (GitHub/GitLab) e importe na Vercel.
2. Framework: **Vite** · Build: `npm run build` · Output: `dist`.
3. Em *Environment Variables*, cadastre `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_SITE_URL`.
4. Depois do primeiro deploy, adicione o domínio em Supabase › Authentication › URL Configuration.

O `vercel.json` faz:
- rewrite de SPA (todas as rotas → `index.html`);
- quando um **robô de preview** (WhatsApp, Facebook, Instagram, X, Telegram…) abre `/post/:slug`, ele recebe `api/share/[slug].js`, que devolve as meta tags Open Graph do post (título, resumo, primeira foto). Pessoas são redirecionadas para a página normal.

Teste o preview em https://developers.facebook.com/tools/debug/ colando o link de um post.

---

## 3.1 Aparecer no Google (SEO)
O que já está pronto:
- **`/sitemap.xml`** (`api/sitemap.js`): lista as páginas públicas e todos os posts publicados, com data e fotos. Posts novos entram sozinhos.
- **`/robots.txt`** (`api/robots.js`): libera o conteúdo público e bloqueia painel, perfil, login etc. Em deploys de preview da Vercel bloqueia tudo.
- **Posts para robôs** (`api/share/[slug].js`): Google, Bing, WhatsApp e redes sociais recebem o post completo (título, texto, fotos, data e dados estruturados `NewsArticle`).
- **Tags por página** (`src/hooks/useSeo.js`): título, descrição, link canônico, Open Graph e `noindex` nas páginas privadas.
- **Dados estruturados** (`index.html`): `Organization` (Bloco Diz Que É, Macau/RN) e `WebSite`.
- Textos de SEO: `SEO` em `src/constants/brand.js` e o `<head>` do `index.html`.

Depois do deploy (com o domínio definitivo):
1. Acesse [Google Search Console](https://search.google.com/search-console) e adicione a propriedade:
   - **Domínio** (recomendado): o Google mostra um registro TXT; cadastre-o no DNS do domínio (na Vercel: *Settings › Domains › DNS Records*).
   - ou **Prefixo do URL**: escolha "Tag HTML" e cole a `<meta name="google-site-verification" ...>` no lugar indicado no `index.html`, faça o deploy e clique em Verificar.
2. Em **Sitemaps**, envie `sitemap.xml`.
3. Em **Inspeção de URL**, teste a página inicial e um post e clique em **Solicitar indexação**.
4. Opcional: repita no [Bing Webmaster Tools](https://www.bing.com/webmasters) (dá para importar do Search Console).
5. Coloque o link do site na bio do Instagram do bloco e descomente `sameAs` no `index.html` com o endereço do perfil.

A indexação costuma levar de alguns dias a algumas semanas.

## 4. Identidade visual
**Pelo painel (sem mexer no código):** *Painel › Identidade visual* (permissão `settings.manage`, que o Super Admin já tem). Lá você troca:
- nome do bloco, nome curto e slogan;
- logo (PNG, SVG, WebP ou JPG — imagens são reduzidas para 512 px);
- as 4 cores da marca, com prévia ao vivo e aviso de contraste.

Tudo é salvo na tabela `app_settings` (migração `0010_brand_settings.sql`) e vale na hora para o site e o painel (inclusive o nome no preview de links compartilhados). Os outros tons da interface (fundos, bordas, modo escuro) são calculados a partir dessas 4 cores.

**No código (pede novo deploy):**
- **Fonte:** Poppins, auto-hospedada via `@fontsource/poppins` (importada em `src/main.jsx`; família em `--font-body` de `src/styles/variables.css`).
- **Ícones do app instalado (PWA)** em `public/icons/` e nome/cor do manifest em `vite.config.js` — o celular guarda esses dados na instalação, então eles não mudam pelo painel.
- **Imagem padrão de compartilhamento:** `public/icons/og-default.png` (1200x630).
- **Valores padrão** (usados antes de salvar no painel): `src/constants/brand.js` e `src/assets/brand/logo-mark.svg`.

## 4.1 Bibliotecas da loja e do financeiro

- `qrcode`: gera o QR Code da retirada no celular do cliente (leve, sem dependências de interface).
- `jsqr`: lê o QR pela câmera quando o navegador não tem leitor nativo (iPhone/Safari). Carregada só na tela de Retirada.
- `write-excel-file`: gera o .xlsx de verdade, com abas e formato de moeda. Carregada só ao exportar.
- O PDF do relatório usa a impressão do navegador ("Salvar como PDF"), sem biblioteca: o texto fica pesquisável e o arquivo sai leve.
- A câmera só funciona em HTTPS (a Vercel já é) ou em localhost.

## 5. Onde mexer
| Quero mudar… | Arquivo |
|---|---|
| Duração/tamanho de vídeos, tamanho das imagens | `src/constants/mediaLimits.js` |
| Emojis de reação | `src/constants/reactions.js` + CHECK em `0002_tables.sql` |
| Texto dos Termos/Privacidade | `src/pages/public/Terms` e `Privacy` (e suba `TERMS_VERSION` em `src/constants/legal.js`) |
| Novas permissões / módulos | `0006_seed.sql` + `src/constants/permissions.js` + `adminNav.js` |

## 6. Estrutura
```
api/share/[slug].js        Vercel Function (Open Graph)
supabase/migrations/       SQL numerado (0001-0013)
supabase/functions/        Edge Functions (create-staff-user, cleanup-stories)
supabase/tests/            teste local de RLS (npm run test:db)
src/components/            common, layout, auth, posts, stories, comments, notifications, admin
src/pages/public|admin/    páginas (carregadas sob demanda)
src/contexts/ hooks/ services/ routes/ styles/ utils/ constants/
src/sw.js                  service worker (cache, offline, push preparado)
```
