# FASE 7 - Retirada com QR Code, estoque e venda rápida

> **Antes de começar:** leia o `CLAUDE.md` e siga-o integralmente. Plano curto → implementar → build/lint/test:db → parar e aguardar validação.

> **Pré-requisito:** Fase 6 concluída e validada.

## Entregas

### Retirada com QR Code
- Pedido **Pago** ou **Pronto para retirada** mostra um **QR Code** em "Meus pedidos" (com o token secreto do pedido, nunca o id). Também mostra o número do pedido em letras grandes, para quando a câmera não ajudar.
- Tela **Retirada** no painel (pensada para o celular): abre a câmera, lê o QR e mostra quem é, os itens, as variações e os nomes, com o botão **"Confirmar retirada"**. Busca manual pelo número como alternativa.
- Avisos claros: "pedido ainda não pago", "já retirado em dd/mm às hh:mm por Fulano", "cancelado".
- Permissão `orders.checkin`, para quem trabalha só na retirada: vê o pedido lido e confirma, sem acesso ao resto.

### Estoque
- **Compras de fornecedor:** fornecedor, data, itens (variação, quantidade, custo unitário), total, observação. Cada compra **soma ao estoque** e registra o custo. Campo "pago / a pagar", usado no financeiro da Fase 8.
- **Ajustes de estoque** (perda, brinde, contagem) com motivo.
- **Movimentações:** histórico por variação (compra, venda online, venda presencial, cancelamento, ajuste), com quem fez e quando.
- **Custo médio** por variação e alerta de estoque baixo (limite configurável por variação).

### Venda rápida (presencial)
- Tela no painel para a barraca: escolher produtos e variações, quantidade, forma de pagamento e nome do cliente (opcional). Gera um pedido do canal **presencial**, já como **Retirado** (ou Pago, se a entrega for depois), e **baixa o estoque**.
- Permissão `sales.create`.

### Permissões novas
`orders.checkin`, `stock.manage`, `sales.create`.

## Banco (migração 0012)
`suppliers`, `purchases`, `purchase_items`, `product_variants.low_stock_alert`, `product_variants.avg_cost`, RPCs de compra, ajuste, check-in e venda rápida (todas registrando em `stock_movements`).

## Biblioteca prevista
- Gerar QR: `qrcode` (leve, sem dependências de UI).
- Ler QR: `BarcodeDetector` do navegador quando existir (Chrome/Android), com `jsqr` como alternativa (iPhone/Safari).

## Ao finalizar
Build, lint e test:db. Passo a passo, checklist de segurança, decisões e pendências. Parar e aguardar validação.
