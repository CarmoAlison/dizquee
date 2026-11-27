# FASE 6 - Loja e pedidos (fechamento pelo WhatsApp)

> **Antes de começar:** leia o `CLAUDE.md` na raiz do projeto (Prompt Mestre) e siga-o integralmente. Apresente um plano curto, implemente criando os arquivos direto no projeto, rode build/lint/test:db e, ao final, pare e aguarde minha validação.

> **Pré-requisito:** fases 1 a 4 concluídas. Mantenha tudo que já existe funcionando.

## Como a venda funciona (decidido)

Não há pagamento online. O cliente (logado) monta o carrinho e **faz o pedido** no site. O pedido nasce como **Aguardando pagamento** e já reserva o estoque. Em seguida o cliente fala com o bloco pelo **WhatsApp** (botão com mensagem pronta: número do pedido, itens e total). O admin combina o pagamento por lá, volta ao painel e **atualiza o status**. A partir da Fase 8, o status "Pago" lança a receita no financeiro automaticamente.

## Entregas

### Catálogo (admin)
- **Produtos** com: nome, slug, descrição, fotos (várias, com ordem), tipo **simples** ou **kit**, ativo/inativo, ordem na loja e a opção **"pedir nome de quem vai usar"** (nominal opcional, por produto).
- **Variações** por produto simples (ex.: "P", "M", "Baby look M", "Copo 500 ml rosa"), cada uma com **estoque próprio**, ativo/inativo e ordem. Produto sem variação usa uma variação única ("Único"), escondida na loja.
- **Lotes** com preço que sobe: nome (1º lote, 2º lote…), preço, início e fim opcionais e quantidade máxima opcional. O preço vigente é o do primeiro lote, na ordem, que está dentro do prazo e não esgotou. Se nenhum lote está vigente, o produto aparece como "Em breve / Esgotado".
- **Kits** (ex.: abadá + copo): o admin escolhe os produtos que compõem o kit e as quantidades. O cliente escolhe a variação de cada item do kit (ex.: tamanho do abadá). O estoque baixa dos itens que compõem o kit. O kit tem lotes e preço próprios.
- **Configurações da loja:** loja aberta/fechada, número de WhatsApp do bloco, texto de retirada (local e datas) e um aviso opcional.

### Loja (público)
- Página **/loja** com os produtos ativos (foto, nome, preço do lote vigente, selo do lote, "Esgotado"). Visitante vê tudo, e ao tentar comprar abre o modal de login, como já acontece nas curtidas.
- Página do produto **/loja/:slug**: carrossel de fotos, descrição, escolha de variação (ou das variações de cada item do kit), quantidade, nome de quem vai usar (quando o produto pede) e "Adicionar ao carrinho".
- **Carrinho** guardado no aparelho (localStorage), com ícone e contador no header e na barra inferior.
- **Finalizar pedido:** confirma o WhatsApp do cliente (vem do perfil), campo de observação, resumo e "Fazer pedido". O preço e o estoque são **sempre recalculados no banco** (RPC), nunca confiados ao navegador.
- Tela de pedido criado com o **botão "Enviar pelo WhatsApp"** (wa.me com mensagem pronta).

### Meus pedidos (cliente)
- **/pedidos**: lista com número, data, total e status.
- **/pedidos/:numero**: itens, variações, nomes, total, linha do tempo do status, texto de retirada, botão do WhatsApp e **cancelar** enquanto estiver "Aguardando pagamento" (devolve o estoque).

### Pedidos (admin)
- Página com **todos os pedidos**: busca (número, nome, @, telefone), filtros por status e período, total do período filtrado.
- Detalhe do pedido: cliente, itens, histórico, **botão "Chamar no WhatsApp"** do cliente e **mudança de status** com observação: Aguardando pagamento → Pago → Pronto para retirada → Retirado; também Cancelado e Reembolsado. No "Pago", informar a forma de pagamento (Pix, dinheiro, cartão, outro).
- Cancelar ou reembolsar devolve o estoque (e o lote) quando o item ainda não foi retirado.

### Avisos e auditoria
- Notificação no site para o **cliente** a cada mudança de status, e para a **equipe com orders.view** quando chega um pedido novo (sino com Realtime, que já existe).
- Auditoria de produtos, lotes, variações, configurações da loja e mudanças de status.

## Banco (migração 0011)

```
shop_settings          (id=1, is_open, whatsapp_number, pickup_info, notice)
products               (id, name, slug UNIQUE, description, kind simple|kit, is_active,
                        ask_holder_name, position, created_at, updated_at)
product_images         (id, product_id, storage_path, position)
product_variants       (id, product_id, name, stock, is_active, position)
product_lots           (id, product_id, name, price, starts_at, ends_at,
                        quantity_limit, sold_count, position)
kit_items              (kit_id, product_id, quantity)
orders                 (id, number, user_id, status, channel, customer_name,
                        customer_phone, notes, total, payment_method, pickup_token,
                        created_at, updated_at, paid_at, ready_at, picked_up_at,
                        cancelled_at, refunded_at)
order_items            (id, order_id, product_id, product_name, lot_id, lot_name,
                        unit_price, quantity, holder_names[])
order_item_parts       (id, order_item_id, variant_id, product_name, variant_name, quantity)
order_status_history   (id, order_id, from_status, to_status, note, actor_id, created_at)
stock_movements        (id, variant_id, quantity (+/-), reason, order_id, note,
                        actor_id, created_at)   -- base para o controle de estoque da Fase 7
```

- RPCs: `create_order`, `cancel_my_order`, `admin_set_order_status`, `admin_orders_summary`.
- Bucket `product-images` (leitura pública; upload com products.manage).
- Permissões novas: `products.manage`, `orders.view`, `orders.manage`.

## Ao finalizar
- Build, lint e test:db sem erros.
- Passo a passo de teste, checklist de segurança/RLS, decisões e pendências. Parar e aguardar validação.
