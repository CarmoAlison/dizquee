# FASE 4 - Painel admin completo

> **Antes de começar:** leia o `CLAUDE.md` na raiz do projeto (Prompt Mestre) e siga-o integralmente. Apresente um plano curto, implemente criando os arquivos direto no projeto, rode build/lint e, ao final, pare e aguarde minha validação.

> **Pré-requisito:** as fases anteriores já estão concluídas e testadas. Mantenha tudo que já existe funcionando.

Execute a **Fase 4**, seguindo o Prompt Mestre e mantendo tudo das fases anteriores. Entregue:

- Layout do admin (sidebar no desktop, menu inferior/gaveta no celular) mostrando apenas os módulos permitidos ao usuário.
- Dashboard com métricas: novos cadastros por dia, total de usuários, posts mais curtidos/comentados, stories mais vistos, atividade recente (usar RPCs/views no banco).
- Clientes: lista com busca e filtros, perfil detalhado com histórico de curtidas e comentários, banir/desbanir com motivo.
- Equipe interna: criar usuários internos via Edge Function (service role), ativar/desativar, trocar perfil de acesso.
- Perfis de acesso: CRUD de roles com matriz detalhada de permissões por módulo, duplicar perfil, proteger perfis de sistema.
- Moderação de comentários (posts e stories) e log de auditoria (audit_logs) com filtros.
- Revisão final de segurança: teste de cada permissão, tentativa de burlar via API direta, checklist completo.
- Revisão final de responsividade, acessibilidade, performance (Lighthouse) e README atualizado.

## Ao finalizar

- Rodar build e lint sem erros.
- Entregar passo a passo de teste, checklist de segurança/RLS desta fase, decisões tomadas e pendências.
- Parar e aguardar minha validação.
