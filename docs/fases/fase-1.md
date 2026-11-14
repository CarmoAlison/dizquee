# FASE 1 - Base, banco, autenticação e layout

> **Antes de começar:** leia o `CLAUDE.md` na raiz do projeto (Prompt Mestre) e siga-o integralmente. Apresente um plano curto, implemente criando os arquivos direto no projeto, rode build/lint e, ao final, pare e aguarde minha validação.

Execute a **Fase 1** do projeto do bloco de carnaval, seguindo o Prompt Mestre. Entregue:

- Projeto Vite + React configurado, com toda a estrutura de pastas da seção 16 (pode deixar pastas das próximas fases com arquivos vazios ou placeholders).
- styles/variables.css, global.css, reset.css e themes.css com as cores, espaçamentos, tipografia, raios, sombras, breakpoints e modo claro/escuro.
- Componentes base: Button, Input, Modal, Avatar, Skeleton, EmptyState, Toast, Loader, WaveDivider, Logo.
- Layout responsivo: Header (desktop), BottomNav (celular), Footer, e o convite constante de cadastro para visitantes.
- Supabase: client, AuthContext, migrações 0001 a 0006 (extensões, tabelas **de todas as fases**, funções, triggers, RLS inicial, buckets e seed de permissões e Super Admin).
- Autenticação completa: login (e-mail/senha, Google, telefone OTP), cadastro com todos os campos, usuário único com validação em tempo real, completar cadastro, aceite LGPD, recuperação de senha, páginas de Termos e Privacidade.
- Rotas públicas, protegidas e de admin, com ProtectedRoute, PermissionGate e usePermission.
- Página de perfil do usuário (editar nome, usuário, telefone, foto; excluir conta).
- PWA básico (manifest, ícones, service worker) e vercel.json.
- README com configuração do Supabase (incluindo Google e SMS) e deploy na Vercel.

## Ao finalizar

- Rodar build e lint sem erros.
- Entregar passo a passo de teste, checklist de segurança/RLS desta fase, decisões tomadas e pendências.
- Parar e aguardar minha validação.
