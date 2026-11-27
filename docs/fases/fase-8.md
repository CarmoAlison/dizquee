# FASE 8 - Financeiro do bloco e relatórios

> **Antes de começar:** leia o `CLAUDE.md` e siga-o integralmente. Plano curto → implementar → build/lint/test:db → parar e aguardar validação.

> **Pré-requisito:** Fase 7 concluída e validada.

## Entregas

### Lançamentos (bloco inteiro)
- **Receitas e despesas** com: descrição, categoria, valor, vencimento, status (**a pagar / pago** ou **a receber / recebido**), data do pagamento, forma de pagamento e observação.
- **Categorias financeiras** editáveis (ex.: Venda de produtos, Patrocínio, Banda, Trio, Segurança, Licenças, Fornecedores).
- **Automáticos (não editáveis à mão, só pela origem):**
  - pedido marcado como **Pago** (online ou venda rápida) → receita recebida;
  - pedido **Reembolsado** depois de pago → despesa de estorno;
  - pedido **Cancelado** depois de pago → o lançamento é estornado;
  - **compra de fornecedor** (Fase 7) → despesa, a pagar ou paga, conforme a compra.
- Pedidos já pagos antes desta fase entram no financeiro de uma vez (backfill na migração).

### Painel financeiro
- Resumo por período: entradas, saídas, saldo, a pagar e a receber (vencidos em destaque).
- Gráfico de entradas e saídas por dia, semana ou mês.
- **Vendas por produto e variação:** quantidade, receita, custo (custo médio da Fase 7) e **lucro**.

### Relatórios e exportação
- **CSV** e **Excel (.xlsx)** dos lançamentos e das vendas por produto.
- **PDF** com a cara do sistema: logo, cores da marca, período, resumo, tabelas e data de emissão.

### Permissões novas
`finance.view` (ver e exportar) e `finance.manage` (lançar, editar, marcar como pago).

## Banco (migração 0013)
`finance_categories`, `finance_entries` (type income|expense, status, source manual|order|refund|purchase, order_id, purchase_id…), triggers a partir de `orders` e `purchases`, RPCs de resumo e de vendas por produto.

## Ao finalizar
Build, lint e test:db. Passo a passo, checklist de segurança, decisões e pendências. Parar e aguardar validação.
