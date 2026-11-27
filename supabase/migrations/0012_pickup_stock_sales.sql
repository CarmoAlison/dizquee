-- =====================================================================
-- 0012 - Fase 7: retirada com QR Code, estoque e venda rápida
--   * QR da retirada: token secreto do pedido (só o dono lê) e check-in
--     pela equipe (orders.checkin)
--   * fornecedores, compras (entrada no estoque com custo) e custo médio
--     por variação; ajustes de estoque com motivo; alerta de estoque baixo
--   * venda rápida presencial (sales.create), com a mesma regra de preço
--     e estoque dos pedidos do site
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, description) values
  ('orders.checkin', 'orders', 'Confirmar a retirada de pedidos (leitura do QR Code)'),
  ('stock.manage',   'stock',  'Registrar compras de fornecedor, ajustar estoque e ver custos e movimentações'),
  ('sales.create',   'sales',  'Fazer vendas rápidas presenciais (barraca)')
on conflict (key) do update set module = excluded.module, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and p.key in ('orders.checkin', 'stock.manage', 'sales.create')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
-- Alerta de estoque baixo por variação (null = sem alerta)
alter table public.product_variants add column if not exists low_stock_alert integer
  check (low_stock_alert is null or low_stock_alert >= 0);

-- Custo médio por variação: tabela separada para NUNCA sair na leitura
-- pública das variações (a loja lê product_variants)
create table if not exists public.variant_costs (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  avg_cost   numeric(10, 2) not null check (avg_cost >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(trim(name)) between 2 and 80),
  phone      text check (char_length(phone) <= 30),
  notes      text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid references public.suppliers(id) on delete set null,
  supplier_name  text not null check (char_length(supplier_name) <= 80),
  purchased_at   date not null default current_date,
  total          numeric(12, 2) not null default 0 check (total >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  due_date       date,
  paid_at        date,
  notes          text check (char_length(notes) <= 500),
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists purchases_date_idx on public.purchases (purchased_at desc, created_at desc);
create index if not exists purchases_supplier_idx on public.purchases (supplier_id);

create table if not exists public.purchase_items (
  id           uuid primary key default gen_random_uuid(),
  purchase_id  uuid not null references public.purchases(id) on delete cascade,
  variant_id   uuid references public.product_variants(id) on delete set null,
  product_name text not null check (char_length(product_name) <= 80),
  variant_name text not null check (char_length(variant_name) <= 60),
  quantity     integer not null check (quantity between 1 and 100000),
  unit_cost    numeric(10, 2) not null check (unit_cost >= 0)
);
create index if not exists purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index if not exists purchase_items_variant_idx on public.purchase_items (variant_id);

alter table public.stock_movements add column if not exists purchase_id uuid references public.purchases(id) on delete set null;
create index if not exists stock_movements_purchase_idx on public.stock_movements (purchase_id);

-- ---------------------------------------------------------------------
-- Catálogo (o mesmo JSON da loja; a equipe de vendas vê também os ocultos)
-- ---------------------------------------------------------------------
create or replace function public.catalog_json(p_slug text, p_include_inactive boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(item order by (item ->> 'position')::int, item ->> 'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'description', p.description,
      'kind', p.kind,
      'is_active', p.is_active,
      'ask_holder_name', p.ask_holder_name,
      'position', p.position,
      'images', coalesce((
        select jsonb_agg(jsonb_build_object('id', i.id, 'storage_path', i.storage_path) order by i.position, i.created_at)
        from public.product_images i where i.product_id = p.id
      ), '[]'::jsonb),
      'variants', coalesce((
        select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'stock', v.stock) order by v.position, v.created_at)
        from public.product_variants v where v.product_id = p.id and v.is_active
      ), '[]'::jsonb),
      'kit_items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id', c.id,
          'name', c.name,
          'quantity', k.quantity,
          'variants', coalesce((
            select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'stock', v.stock) order by v.position, v.created_at)
            from public.product_variants v where v.product_id = c.id and v.is_active
          ), '[]'::jsonb)
        ) order by k.position, c.name)
        from public.kit_items k join public.products c on c.id = k.product_id
        where k.kit_id = p.id
      ), '[]'::jsonb),
      'lot', (
        select jsonb_build_object(
          'id', l.id, 'name', l.name, 'price', l.price, 'ends_at', l.ends_at,
          'remaining', case when l.quantity_limit is null then null else l.quantity_limit - l.sold_count end
        )
        from public.product_lots l where l.id = cur.lot_id
      ),
      'next_lot', (
        select jsonb_build_object('name', l.name, 'price', l.price, 'starts_at', l.starts_at)
        from public.product_lots l
        where l.product_id = p.id
          and l.id is distinct from cur.lot_id
          and (l.ends_at is null or l.ends_at > now())
          and (l.quantity_limit is null or l.sold_count < l.quantity_limit)
          and (cur.lot_id is null or (l.position, l.created_at) > (
                select cl.position, cl.created_at from public.product_lots cl where cl.id = cur.lot_id))
        order by l.position, l.created_at
        limit 1
      )
    ) as item
    from public.products p
    cross join lateral (select public.product_current_lot(p.id) as lot_id) cur
    where (p.is_active or p_include_inactive)
      and (p_slug is null or p.slug = p_slug)
  ) s;
$$;

create or replace function public.shop_catalog(p_slug text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.catalog_json(p_slug, false);
$$;

create or replace function public.staff_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_any_permission(array['sales.create', 'products.manage']) then
    raise exception 'Sem permissão (sales.create).' using errcode = '42501';
  end if;
  return public.catalog_json(null, true);
end;
$$;

-- ---------------------------------------------------------------------
-- Itens do pedido (interna): valida escolhas, divide entre lotes, baixa
-- o estoque e registra as movimentações. Usada pelo pedido do site e
-- pela venda rápida. Retorna { total, count }.
-- ---------------------------------------------------------------------
create or replace function public.fill_order_items(
  p_order_id uuid, p_items jsonb, p_actor uuid, p_reason text, p_only_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item    jsonb;
  v_product public.products%rowtype;
  v_qty     integer;
  v_left    integer;
  v_chunk   integer;
  v_lot     public.product_lots%rowtype;
  v_item_id uuid;
  v_names   text[];
  v_offset  integer;
  v_total   numeric(10, 2) := 0;
  v_count   integer := 0;
  v_parts   jsonb;
  v_part    jsonb;
  v_variant public.product_variants%rowtype;
  v_comp    record;
  v_chosen  uuid;
  v_guard   integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nenhum item no pedido.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'Muitos itens em um só pedido (máximo 30).' using errcode = 'P0001';
  end if;

  perform set_config('app.counter_update', 'on', true);

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
      where id = nullif(v_item ->> 'product_id', '')::uuid and (is_active or not p_only_active);
    if not found then
      raise exception 'Um dos produtos não está mais disponível.' using errcode = 'P0001';
    end if;

    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 50 then
      raise exception 'Quantidade inválida para %.', v_product.name using errcode = 'P0001';
    end if;

    v_names := '{}';
    if v_product.ask_holder_name and jsonb_typeof(v_item -> 'holder_names') = 'array' then
      select coalesce(array_agg(left(trim(n), 80)), '{}') into v_names
      from jsonb_array_elements_text(v_item -> 'holder_names') as n
      where trim(n) <> '';
      if cardinality(v_names) > v_qty then
        raise exception 'Mais nomes do que unidades em %.', v_product.name using errcode = 'P0001';
      end if;
    end if;

    v_parts := '[]'::jsonb;
    if v_product.kind = 'simple' then
      select * into v_variant from public.product_variants
        where id = nullif(v_item ->> 'variant_id', '')::uuid and product_id = v_product.id and is_active;
      if not found then
        raise exception 'Escolha uma opção válida de %.', v_product.name using errcode = 'P0001';
      end if;
      v_parts := jsonb_build_array(jsonb_build_object('variant_id', v_variant.id, 'per_unit', 1));
    else
      if not exists (select 1 from public.kit_items where kit_id = v_product.id) then
        raise exception 'O kit % ainda não está montado.', v_product.name using errcode = 'P0001';
      end if;
      for v_comp in
        select k.product_id, k.quantity, c.name from public.kit_items k
        join public.products c on c.id = k.product_id
        where k.kit_id = v_product.id order by k.position
      loop
        v_chosen := null;
        select nullif(x ->> 'variant_id', '')::uuid into v_chosen
        from jsonb_array_elements(coalesce(v_item -> 'parts', '[]'::jsonb)) x
        where nullif(x ->> 'product_id', '')::uuid = v_comp.product_id
        limit 1;
        if v_chosen is null or not exists (
          select 1 from public.product_variants where id = v_chosen and product_id = v_comp.product_id and is_active
        ) then
          raise exception 'Escolha a opção de % no kit %.', v_comp.name, v_product.name using errcode = 'P0001';
        end if;
        v_parts := v_parts || jsonb_build_array(jsonb_build_object('variant_id', v_chosen, 'per_unit', v_comp.quantity));
      end loop;
    end if;

    v_left := v_qty;
    v_offset := 0;
    v_guard := 0;
    while v_left > 0 loop
      v_guard := v_guard + 1;
      if v_guard > 50 then
        raise exception 'Muita procura agora em %. Tente de novo.', v_product.name using errcode = 'P0001';
      end if;
      select * into v_lot from public.product_lots
        where id = public.product_current_lot(v_product.id)
        for update;
      if not found then
        if v_left = v_qty then
          raise exception '% não está à venda agora (sem lote aberto).', v_product.name using errcode = 'P0001';
        end if;
        raise exception 'Só restam % unidade(s) de % à venda.', v_qty - v_left, v_product.name using errcode = 'P0001';
      end if;
      v_chunk := case when v_lot.quantity_limit is null then v_left
                      else least(v_left, v_lot.quantity_limit - v_lot.sold_count) end;
      if v_chunk <= 0 then
        continue;
      end if;

      update public.product_lots set sold_count = sold_count + v_chunk where id = v_lot.id;

      insert into public.order_items (order_id, product_id, product_name, product_kind, lot_id, lot_name, unit_price, quantity, holder_names)
      values (p_order_id, v_product.id, v_product.name, v_product.kind, v_lot.id, v_lot.name, v_lot.price, v_chunk,
              coalesce(v_names[v_offset + 1 : v_offset + v_chunk], '{}'))
      returning id into v_item_id;

      for v_part in select * from jsonb_array_elements(v_parts) loop
        update public.product_variants
           set stock = stock - v_chunk * (v_part ->> 'per_unit')::integer
         where id = (v_part ->> 'variant_id')::uuid
           and stock >= v_chunk * (v_part ->> 'per_unit')::integer
        returning * into v_variant;
        if not found then
          select * into v_variant from public.product_variants where id = (v_part ->> 'variant_id')::uuid;
          raise exception 'Estoque insuficiente: % (%). Restam %.',
            (select name from public.products where id = v_variant.product_id), v_variant.name, v_variant.stock
            using errcode = 'P0001';
        end if;
        insert into public.order_item_parts (order_item_id, variant_id, product_name, variant_name, quantity)
        values (v_item_id, v_variant.id, (select name from public.products where id = v_variant.product_id),
                v_variant.name, v_chunk * (v_part ->> 'per_unit')::integer);
        insert into public.stock_movements (variant_id, quantity, reason, order_id, actor_id)
        values (v_variant.id, -(v_chunk * (v_part ->> 'per_unit')::integer), p_reason, p_order_id, p_actor);
      end loop;

      v_total := v_total + v_lot.price * v_chunk;
      v_count := v_count + v_chunk;
      v_offset := v_offset + v_chunk;
      v_left := v_left - v_chunk;
    end loop;
  end loop;

  perform set_config('app.counter_update', 'off', true);

  update public.orders set total = v_total, item_count = v_count where id = p_order_id;
  return jsonb_build_object('total', v_total, 'count', v_count);
end;
$$;

-- Pedido do site (mesmas regras da 0011, agora usando fill_order_items)
create or replace function public.create_order(p_items jsonb, p_phone text, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_phone   text := public.normalize_phone(p_phone);
  v_order   public.orders%rowtype;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para fazer o pedido.' using errcode = '42501';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.is_banned then
    raise exception 'Sua conta não pode fazer pedidos.' using errcode = '42501';
  end if;
  if v_profile.username is null or v_profile.terms_accepted_at is null then
    raise exception 'Complete seu cadastro antes de fazer o pedido.' using errcode = '42501';
  end if;
  if not coalesce((select is_open from public.shop_settings where id = 1), false) then
    raise exception 'A loja está fechada no momento.' using errcode = 'P0001';
  end if;
  if v_phone is null then
    raise exception 'Informe um WhatsApp válido com DDD.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Seu carrinho está vazio.' using errcode = 'P0001';
  end if;

  insert into public.orders (user_id, customer_name, customer_phone, notes)
  values (v_uid, left(coalesce(v_profile.full_name, v_profile.username), 80), v_phone, nullif(left(trim(coalesce(p_notes, '')), 500), ''))
  returning * into v_order;

  v_result := public.fill_order_items(v_order.id, p_items, v_uid, 'order', true);

  insert into public.order_status_history (order_id, from_status, to_status, actor_id)
  values (v_order.id, null, 'pending', v_uid);

  insert into public.notifications (user_id, type, actor_id, order_id, meta)
  select s, 'order_created', v_uid, v_order.id,
         jsonb_build_object('number', v_order.number, 'total', v_result -> 'total')
  from public.staff_with_permission('orders.view') s
  where s <> v_uid;

  return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'total', v_result -> 'total');
end;
$$;

-- ---------------------------------------------------------------------
-- Venda rápida (presencial): já nasce paga e, se entregue na hora, retirada
-- ---------------------------------------------------------------------
create or replace function public.quick_sale(
  p_items jsonb, p_payment_method text, p_customer_name text default null,
  p_customer_phone text default null, p_delivered boolean default true, p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_order  public.orders%rowtype;
  v_result jsonb;
  v_phone  text := public.normalize_phone(p_customer_phone);
begin
  perform public.assert_permission('sales.create');
  if p_payment_method is null or p_payment_method not in ('pix', 'dinheiro', 'cartao', 'outro') then
    raise exception 'Informe a forma de pagamento.' using errcode = 'P0001';
  end if;
  if nullif(trim(coalesce(p_customer_phone, '')), '') is not null and v_phone is null then
    raise exception 'Telefone do cliente inválido.' using errcode = 'P0001';
  end if;

  insert into public.orders (user_id, channel, customer_name, customer_phone, notes)
  values (null, 'presencial', nullif(left(trim(coalesce(p_customer_name, '')), 80), ''), v_phone,
          nullif(left(trim(coalesce(p_notes, '')), 500), ''))
  returning * into v_order;

  v_result := public.fill_order_items(v_order.id, p_items, v_uid, 'sale', false);

  insert into public.order_status_history (order_id, from_status, to_status, note, actor_id)
  values (v_order.id, null, 'pending', 'Venda rápida', v_uid);
  perform public.apply_order_status(v_order.id, 'paid', 'Venda rápida', p_payment_method);
  if p_delivered then
    perform public.apply_order_status(v_order.id, 'picked_up', 'Entregue na hora', null);
  end if;

  return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'total', v_result -> 'total');
end;
$$;

-- ---------------------------------------------------------------------
-- Retirada com QR Code
-- ---------------------------------------------------------------------
-- Token do QR: só o dono do pedido, e só quando ele pode ser retirado
create or replace function public.get_my_pickup_token(p_order_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select o.pickup_token from public.orders o
  where o.id = p_order_id
    and o.user_id = auth.uid()
    and o.status in ('paid', 'ready');
$$;

-- Busca o pedido pelo token do QR ou pelo número (equipe da retirada)
create or replace function public.checkin_lookup(p_token text default null, p_number bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.has_any_permission(array['orders.checkin', 'orders.manage']) then
    raise exception 'Sem permissão (orders.checkin).' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_token, '')), '') is not null then
    select * into v_order from public.orders where pickup_token = trim(p_token);
  elsif p_number is not null then
    select * into v_order from public.orders where number = p_number;
  end if;
  if v_order.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_order.id,
    'number', v_order.number,
    'status', v_order.status,
    'channel', v_order.channel,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'notes', v_order.notes,
    'total', v_order.total,
    'paid_at', v_order.paid_at,
    'picked_up_at', v_order.picked_up_at,
    'picked_up_by', (
      select coalesce(p.full_name, p.username)
      from public.order_status_history h join public.profiles p on p.id = h.actor_id
      where h.order_id = v_order.id and h.to_status = 'picked_up'
      order by h.created_at desc limit 1
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'product_name', i.product_name, 'product_kind', i.product_kind, 'lot_name', i.lot_name,
        'unit_price', i.unit_price, 'quantity', i.quantity, 'holder_names', to_jsonb(i.holder_names),
        'order_item_parts', coalesce((
          select jsonb_agg(jsonb_build_object('id', pa.id, 'product_name', pa.product_name, 'variant_name', pa.variant_name, 'quantity', pa.quantity))
          from public.order_item_parts pa where pa.order_item_id = i.id
        ), '[]'::jsonb)
      ) order by i.created_at)
      from public.order_items i where i.order_id = v_order.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Confirma a retirada
create or replace function public.checkin_confirm(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
begin
  if not public.has_any_permission(array['orders.checkin', 'orders.manage']) then
    raise exception 'Sem permissão (orders.checkin).' using errcode = '42501';
  end if;
  select status into v_status from public.orders where id = p_order_id;
  if v_status is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;
  if v_status = 'picked_up' then
    raise exception 'Este pedido já foi retirado.' using errcode = 'P0001';
  end if;
  if v_status not in ('paid', 'ready') then
    raise exception 'Pedido "%": não pode ser retirado.', public.order_status_label(v_status) using errcode = 'P0001';
  end if;
  perform public.apply_order_status(p_order_id, 'picked_up', 'Retirada confirmada', null);
end;
$$;

-- ---------------------------------------------------------------------
-- Estoque: compras, ajustes, alerta e visão geral (stock.manage)
-- ---------------------------------------------------------------------

-- Compra de fornecedor. p_items: [{ variant_id, quantity, unit_cost }]
create or replace function public.create_purchase(
  p_supplier_name text, p_items jsonb, p_purchased_at date default null,
  p_payment_status text default 'pending', p_due_date date default null, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_name     text := nullif(trim(coalesce(p_supplier_name, '')), '');
  v_supplier public.suppliers%rowtype;
  v_purchase uuid;
  v_item     jsonb;
  v_variant  public.product_variants%rowtype;
  v_qty      integer;
  v_cost     numeric(10, 2);
  v_old_cost numeric(10, 2);
  v_total    numeric(12, 2) := 0;
begin
  perform public.assert_permission('stock.manage');
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Informe o fornecedor.' using errcode = 'P0001';
  end if;
  if p_payment_status not in ('pending', 'paid') then
    raise exception 'Situação de pagamento inválida.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um item à compra.' using errcode = 'P0001';
  end if;

  -- Fornecedor: reaproveita pelo nome (sem diferenciar maiúsculas)
  select * into v_supplier from public.suppliers where lower(name) = lower(v_name);
  if not found then
    insert into public.suppliers (name) values (left(v_name, 80)) returning * into v_supplier;
  end if;

  insert into public.purchases (supplier_id, supplier_name, purchased_at, payment_status, due_date, paid_at, notes, created_by)
  values (v_supplier.id, v_supplier.name, coalesce(p_purchased_at, current_date), p_payment_status, p_due_date,
          case when p_payment_status = 'paid' then coalesce(p_purchased_at, current_date) end,
          nullif(left(trim(coalesce(p_notes, '')), 500), ''), v_uid)
  returning id into v_purchase;

  perform set_config('app.counter_update', 'on', true);
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    v_cost := coalesce((v_item ->> 'unit_cost')::numeric, -1);
    if v_qty < 1 or v_qty > 100000 then
      raise exception 'Quantidade inválida na compra.' using errcode = 'P0001';
    end if;
    if v_cost < 0 then
      raise exception 'Informe o custo unitário de cada item.' using errcode = 'P0001';
    end if;
    select * into v_variant from public.product_variants where id = nullif(v_item ->> 'variant_id', '')::uuid for update;
    if not found then
      raise exception 'Uma das variações não existe mais.' using errcode = 'P0001';
    end if;

    -- custo médio ponderado pelo estoque atual
    select avg_cost into v_old_cost from public.variant_costs where variant_id = v_variant.id;
    insert into public.variant_costs (variant_id, avg_cost, updated_at)
    values (v_variant.id,
            case when v_old_cost is null or v_variant.stock <= 0 then v_cost
                 else round((v_old_cost * v_variant.stock + v_cost * v_qty) / (v_variant.stock + v_qty), 2) end,
            now())
    on conflict (variant_id) do update set avg_cost = excluded.avg_cost, updated_at = excluded.updated_at;

    update public.product_variants set stock = stock + v_qty where id = v_variant.id;
    insert into public.purchase_items (purchase_id, variant_id, product_name, variant_name, quantity, unit_cost)
    values (v_purchase, v_variant.id, (select name from public.products where id = v_variant.product_id), v_variant.name, v_qty, v_cost);
    insert into public.stock_movements (variant_id, quantity, reason, purchase_id, actor_id, note)
    values (v_variant.id, v_qty, 'purchase', v_purchase, v_uid, 'Compra de ' || v_supplier.name);
    v_total := v_total + v_qty * v_cost;
  end loop;
  perform set_config('app.counter_update', 'off', true);

  update public.purchases set total = v_total where id = v_purchase;
  return v_purchase;
end;
$$;

-- Excluir compra lançada errado: tira do estoque o que ela tinha colocado
create or replace function public.delete_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_uid  uuid := auth.uid();
begin
  perform public.assert_permission('stock.manage');
  if not exists (select 1 from public.purchases where id = p_purchase_id) then
    raise exception 'Compra não encontrada.' using errcode = 'P0001';
  end if;
  perform set_config('app.counter_update', 'on', true);
  for v_item in select * from public.purchase_items where purchase_id = p_purchase_id and variant_id is not null loop
    update public.product_variants set stock = stock - v_item.quantity
      where id = v_item.variant_id and stock >= v_item.quantity;
    if not found then
      raise exception 'Não dá para excluir: % (%) já saiu do estoque. Faça um ajuste em vez disso.',
        v_item.product_name, v_item.variant_name using errcode = 'P0001';
    end if;
    insert into public.stock_movements (variant_id, quantity, reason, actor_id, note)
    values (v_item.variant_id, -v_item.quantity, 'adjustment', v_uid, 'Compra excluída (' || v_item.product_name || ')');
  end loop;
  perform set_config('app.counter_update', 'off', true);
  delete from public.purchases where id = p_purchase_id;
end;
$$;

-- Marcar compra como paga / a pagar
create or replace function public.set_purchase_payment(p_purchase_id uuid, p_status text, p_paid_at date default null, p_due_date date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('stock.manage');
  if p_status not in ('pending', 'paid') then
    raise exception 'Situação de pagamento inválida.' using errcode = 'P0001';
  end if;
  update public.purchases set
    payment_status = p_status,
    paid_at = case when p_status = 'paid' then coalesce(p_paid_at, current_date) end,
    due_date = coalesce(p_due_date, due_date)
  where id = p_purchase_id;
  if not found then
    raise exception 'Compra não encontrada.' using errcode = 'P0001';
  end if;
end;
$$;

-- Ajuste manual (perda, brinde, contagem...) com motivo obrigatório
create or replace function public.adjust_stock(p_variant_id uuid, p_delta integer, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note  text := nullif(left(trim(coalesce(p_note, '')), 300), '');
  v_stock integer;
begin
  perform public.assert_permission('stock.manage');
  if p_delta is null or p_delta = 0 then
    raise exception 'Informe quanto entra ou sai do estoque.' using errcode = 'P0001';
  end if;
  if v_note is null then
    raise exception 'Informe o motivo do ajuste.' using errcode = 'P0001';
  end if;
  perform set_config('app.counter_update', 'on', true);
  update public.product_variants set stock = stock + p_delta
    where id = p_variant_id and stock + p_delta >= 0
    returning stock into v_stock;
  if not found then
    raise exception 'O estoque não pode ficar negativo.' using errcode = 'P0001';
  end if;
  insert into public.stock_movements (variant_id, quantity, reason, actor_id, note)
  values (p_variant_id, p_delta, 'adjustment', auth.uid(), v_note);
  perform set_config('app.counter_update', 'off', true);
  return v_stock;
end;
$$;

create or replace function public.set_stock_alert(p_variant_id uuid, p_alert integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('stock.manage');
  if p_alert is not null and p_alert < 0 then
    raise exception 'O alerta precisa ser zero ou mais.' using errcode = 'P0001';
  end if;
  perform set_config('app.counter_update', 'on', true);
  update public.product_variants set low_stock_alert = p_alert where id = p_variant_id;
  perform set_config('app.counter_update', 'off', true);
end;
$$;

-- Visão geral do estoque (todas as variações de produtos simples)
create or replace function public.stock_overview()
returns table (
  variant_id uuid, product_id uuid, product_name text, product_active boolean, variant_name text,
  variant_active boolean, stock integer, low_stock_alert integer, avg_cost numeric,
  reserved integer, sold integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('stock.manage');
  return query
    select v.id, p.id, p.name, p.is_active, v.name, v.is_active, v.stock, v.low_stock_alert, c.avg_cost,
           -- reservado: pedidos aguardando pagamento
           coalesce((select sum(pa.quantity)::integer from public.order_item_parts pa
                     join public.order_items oi on oi.id = pa.order_item_id
                     join public.orders o on o.id = oi.order_id
                     where pa.variant_id = v.id and o.status = 'pending'), 0),
           -- vendido: pagos, prontos e retirados
           coalesce((select sum(pa.quantity)::integer from public.order_item_parts pa
                     join public.order_items oi on oi.id = pa.order_item_id
                     join public.orders o on o.id = oi.order_id
                     where pa.variant_id = v.id and o.status in ('paid', 'ready', 'picked_up')), 0)
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.variant_costs c on c.variant_id = v.id
    order by p.position, p.name, v.position, v.created_at;
end;
$$;

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
drop trigger if exists audit_purchases on public.purchases;
create trigger audit_purchases after insert or delete on public.purchases
  for each row execute function public.audit_generic('purchase', 'supplier_name');

drop trigger if exists audit_suppliers on public.suppliers;
create trigger audit_suppliers after insert or update or delete on public.suppliers
  for each row execute function public.audit_generic('supplier', 'name');

-- Ajuste manual com motivo vai para a auditoria
create or replace function public.audit_stock_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- só ajustes feitos pelas funções (adjust_stock / delete_purchase); a
  -- edição no cadastro do produto já entra como product_variant.update
  if new.reason = 'adjustment' and new.note is not null and auth.uid() is not null
     and coalesce(current_setting('app.counter_update', true), '') = 'on' then
    perform public.log_audit('stock.adjust', 'product_variant', new.variant_id::text, jsonb_build_object(
      'label', (select p.name || ' (' || v.name || ')' from public.product_variants v join public.products p on p.id = v.product_id where v.id = new.variant_id),
      'delta', new.quantity, 'note', new.note));
  end if;
  return null;
end;
$$;

drop trigger if exists audit_stock_adjustment on public.stock_movements;
create trigger audit_stock_adjustment after insert on public.stock_movements
  for each row execute function public.audit_stock_adjustment();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.variant_costs  enable row level security;
alter table public.suppliers      enable row level security;
alter table public.purchases      enable row level security;
alter table public.purchase_items enable row level security;

drop policy if exists variant_costs_select on public.variant_costs;
create policy variant_costs_select on public.variant_costs for select to authenticated
  using (public.has_permission('stock.manage'));

drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers for select to authenticated
  using (public.has_permission('stock.manage'));
drop policy if exists suppliers_write on public.suppliers;
create policy suppliers_write on public.suppliers for all to authenticated
  using (public.has_permission('stock.manage')) with check (public.has_permission('stock.manage'));

drop policy if exists purchases_select on public.purchases;
create policy purchases_select on public.purchases for select to authenticated
  using (public.has_permission('stock.manage'));

drop policy if exists purchase_items_select on public.purchase_items;
create policy purchase_items_select on public.purchase_items for select to authenticated
  using (public.has_permission('stock.manage'));

-- Quem cuida do estoque também enxerga produtos e variações ocultos
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to anon, authenticated
  using (is_active or public.has_any_permission(array['products.manage', 'orders.view', 'stock.manage']));
drop policy if exists product_variants_select on public.product_variants;
create policy product_variants_select on public.product_variants for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active)
         or public.has_any_permission(array['products.manage', 'orders.view', 'stock.manage']));

-- Movimentações: catálogo e estoque
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.has_any_permission(array['products.manage', 'stock.manage']));

-- Compras e custos só mudam pelas funções
revoke all on public.variant_costs, public.purchases, public.purchase_items from anon;
revoke insert, update, delete on public.variant_costs, public.purchases, public.purchase_items from authenticated;
grant select on public.variant_costs, public.purchases, public.purchase_items to authenticated;
revoke all on public.suppliers from anon;

-- ---------------------------------------------------------------------
-- Privilégios de execução
-- ---------------------------------------------------------------------
revoke execute on function public.catalog_json(text, boolean) from public, anon, authenticated;
revoke execute on function public.fill_order_items(uuid, jsonb, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.audit_stock_adjustment() from public, anon, authenticated;

grant execute on function public.shop_catalog(text) to anon, authenticated;
revoke execute on function public.staff_catalog() from public, anon;
grant execute on function public.staff_catalog() to authenticated;
revoke execute on function public.quick_sale(jsonb, text, text, text, boolean, text) from public, anon;
grant execute on function public.quick_sale(jsonb, text, text, text, boolean, text) to authenticated;
revoke execute on function public.get_my_pickup_token(uuid) from public, anon;
grant execute on function public.get_my_pickup_token(uuid) to authenticated;
revoke execute on function public.checkin_lookup(text, bigint) from public, anon;
grant execute on function public.checkin_lookup(text, bigint) to authenticated;
revoke execute on function public.checkin_confirm(uuid) from public, anon;
grant execute on function public.checkin_confirm(uuid) to authenticated;
revoke execute on function public.create_purchase(text, jsonb, date, text, date, text) from public, anon;
grant execute on function public.create_purchase(text, jsonb, date, text, date, text) to authenticated;
revoke execute on function public.delete_purchase(uuid) from public, anon;
grant execute on function public.delete_purchase(uuid) to authenticated;
revoke execute on function public.set_purchase_payment(uuid, text, date, date) from public, anon;
grant execute on function public.set_purchase_payment(uuid, text, date, date) to authenticated;
revoke execute on function public.adjust_stock(uuid, integer, text) from public, anon;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;
revoke execute on function public.set_stock_alert(uuid, integer) from public, anon;
grant execute on function public.set_stock_alert(uuid, integer) to authenticated;
revoke execute on function public.stock_overview() from public, anon;
grant execute on function public.stock_overview() to authenticated;
