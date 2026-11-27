-- =====================================================================
-- 0011 - Fase 6: loja e pedidos (fechamento pelo WhatsApp)
--   * catálogo: produtos simples e kits, fotos, variações com estoque,
--     lotes com preço/prazo/quantidade e itens do kit
--   * pedidos: itens, variações baixadas do estoque, histórico de status
--   * movimentações de estoque (base para a Fase 7)
--   * RPCs: shop_catalog, create_order, cancel_my_order,
--     admin_set_order_status, admin_orders_summary
--   * notificações de pedido (cliente e equipe), auditoria, RLS e Storage
-- Preço e estoque são SEMPRE calculados aqui no banco; o navegador só
-- informa o que a pessoa escolheu.
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.product_kind as enum ('simple', 'kit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending',    -- Aguardando pagamento (estoque já reservado)
    'paid',       -- Pago
    'ready',      -- Pronto para retirada
    'picked_up',  -- Retirado
    'cancelled',  -- Cancelado (estoque devolvido)
    'refunded'    -- Reembolsado
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_channel as enum ('online', 'presencial');
exception when duplicate_object then null; end $$;

-- Novos tipos de notificação (os valores só são usados dentro de funções,
-- então podem ser criados na mesma transação)
alter type public.notification_type add value if not exists 'order_created'; -- equipe: chegou pedido novo
alter type public.notification_type add value if not exists 'order_status';  -- cliente: status mudou

-- ---------------------------------------------------------------------
-- Configurações da loja (linha única)
-- ---------------------------------------------------------------------
create table if not exists public.shop_settings (
  id              smallint primary key default 1 check (id = 1),
  is_open         boolean not null default true,
  whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  pickup_info     text check (char_length(pickup_info) <= 1000),
  notice          text check (char_length(notice) <= 300),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null
);
insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(trim(name)) between 2 and 80),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90),
  description     text check (char_length(description) <= 3000),
  kind            public.product_kind not null default 'simple',
  is_active       boolean not null default false,
  ask_holder_name boolean not null default false, -- pedir o nome de quem vai usar (opcional ao cliente)
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists products_position_idx on public.products (position, created_at);
create index if not exists products_active_idx on public.products (is_active) where is_active;

create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  storage_path text not null check (char_length(storage_path) <= 300),
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id, position);

-- Variações (tamanho, modelo, cor...). Produto sem variação usa uma única ("Único").
create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 60),
  stock      integer not null default 0 check (stock >= 0),
  is_active  boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, name)
);
create index if not exists product_variants_product_idx on public.product_variants (product_id, position);

-- Lotes: o vigente é o primeiro (por position) dentro do prazo e não esgotado
create table if not exists public.product_lots (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 40),
  price          numeric(10, 2) not null check (price >= 0 and price <= 100000),
  starts_at      timestamptz,
  ends_at        timestamptz,
  quantity_limit integer check (quantity_limit is null or quantity_limit > 0),
  sold_count     integer not null default 0 check (sold_count >= 0),
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists product_lots_product_idx on public.product_lots (product_id, position);

-- Composição do kit (kit -> produtos simples)
create table if not exists public.kit_items (
  kit_id     uuid not null references public.products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity   integer not null default 1 check (quantity between 1 and 20),
  position   integer not null default 0,
  primary key (kit_id, product_id),
  check (kit_id <> product_id)
);
create index if not exists kit_items_product_idx on public.kit_items (product_id);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity (start with 1001) unique,
  user_id        uuid references public.profiles(id) on delete set null,
  status         public.order_status not null default 'pending',
  channel        public.order_channel not null default 'online',
  -- cópia dos dados do cliente no momento do pedido (a equipe de pedidos
  -- não precisa ter acesso à lista de clientes)
  customer_name  text check (char_length(customer_name) <= 80),
  customer_phone text check (customer_phone is null or customer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  notes          text check (char_length(notes) <= 500),
  total          numeric(10, 2) not null default 0 check (total >= 0),
  item_count     integer not null default 0 check (item_count >= 0),
  payment_method text check (payment_method in ('pix', 'dinheiro', 'cartao', 'outro')),
  -- segredo do QR Code da retirada (Fase 7); nunca usar o id/número
  pickup_token   text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  paid_at        timestamptz,
  ready_at       timestamptz,
  picked_up_at   timestamptz,
  cancelled_at   timestamptz,
  refunded_at    timestamptz
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete restrict,
  product_name text not null check (char_length(product_name) <= 80),
  product_kind public.product_kind not null default 'simple',
  lot_id       uuid references public.product_lots(id) on delete restrict,
  lot_name     text check (char_length(lot_name) <= 40),
  unit_price   numeric(10, 2) not null check (unit_price >= 0),
  quantity     integer not null check (quantity between 1 and 50),
  holder_names text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists order_items_lot_idx on public.order_items (lot_id);

-- O que saiu do estoque para cada item (1 linha no simples; 1 por componente no kit)
create table if not exists public.order_item_parts (
  id            uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  variant_id    uuid references public.product_variants(id) on delete restrict,
  product_name  text not null check (char_length(product_name) <= 80),
  variant_name  text not null check (char_length(variant_name) <= 60),
  quantity      integer not null check (quantity > 0)
);
create index if not exists order_item_parts_item_idx on public.order_item_parts (order_item_id);
create index if not exists order_item_parts_variant_idx on public.order_item_parts (variant_id);

create table if not exists public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  note        text check (char_length(note) <= 500),
  actor_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- Movimentações de estoque (+ entrada / - saída). A Fase 7 adiciona compras e ajustes.
create table if not exists public.stock_movements (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity   integer not null check (quantity <> 0),
  reason     text not null check (reason in ('order', 'order_return', 'purchase', 'adjustment', 'sale', 'initial')),
  order_id   uuid references public.orders(id) on delete set null,
  note       text check (char_length(note) <= 300),
  actor_id   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_variant_idx on public.stock_movements (variant_id, created_at desc);
create index if not exists stock_movements_order_idx on public.stock_movements (order_id);

-- Notificações de pedido
alter table public.notifications add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.notifications add column if not exists meta jsonb not null default '{}'::jsonb;
create index if not exists notifications_order_idx on public.notifications (order_id);

-- ---------------------------------------------------------------------
-- Permissões novas
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, description) values
  ('products.manage', 'shop',   'Cadastrar produtos, fotos, variações, estoque, lotes, kits e configurar a loja'),
  ('orders.view',     'orders', 'Ver pedidos e receber aviso de pedido novo'),
  ('orders.manage',   'orders', 'Alterar o status dos pedidos (pago, pronto, retirado, cancelado, reembolsado)')
on conflict (key) do update set module = excluded.module, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and p.key in ('products.manage', 'orders.view', 'orders.manage')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Regras do catálogo
-- ---------------------------------------------------------------------
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Não trocar o tipo (simples <-> kit) quando isso deixaria dados incoerentes
-- e não excluir produto que já foi vendido (o certo é desativar).
create or replace function public.products_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.order_items where product_id = old.id) then
      raise exception 'Este produto já tem pedidos. Desative-o em vez de excluir.' using errcode = '23503';
    end if;
    if exists (select 1 from public.kit_items where product_id = old.id) then
      raise exception 'Este produto faz parte de um kit. Tire-o do kit antes de excluir.' using errcode = '23503';
    end if;
    return old;
  end if;

  if new.kind is distinct from old.kind then
    if new.kind = 'kit' and exists (select 1 from public.product_variants where product_id = new.id) then
      raise exception 'Remova as variações antes de transformar o produto em kit.' using errcode = '23514';
    end if;
    if new.kind = 'kit' and exists (select 1 from public.kit_items where product_id = new.id) then
      raise exception 'Este produto faz parte de um kit e não pode virar kit.' using errcode = '23514';
    end if;
    if new.kind = 'simple' and exists (select 1 from public.kit_items where kit_id = new.id) then
      raise exception 'Remova os itens do kit antes de transformá-lo em produto simples.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard on public.products;
create trigger products_guard before update or delete on public.products
  for each row execute function public.products_guard();

-- Variação só em produto simples; variação vendida não é excluída
create or replace function public.product_variants_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.order_item_parts where variant_id = old.id) then
      raise exception 'Esta variação já tem pedidos. Desative-a em vez de excluir.' using errcode = '23503';
    end if;
    return old;
  end if;
  if exists (select 1 from public.products where id = new.product_id and kind = 'kit') then
    raise exception 'Kits não têm variações próprias: as variações vêm dos itens do kit.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.product_id <> old.product_id then
    raise exception 'Não é possível mover a variação para outro produto.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists product_variants_guard on public.product_variants;
create trigger product_variants_guard before insert or update or delete on public.product_variants
  for each row execute function public.product_variants_guard();

-- Lote vendido não é excluído (o histórico de preço fica nos pedidos)
create or replace function public.product_lots_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.order_items where lot_id = old.id) then
    raise exception 'Este lote já tem vendas e não pode ser excluído. Ajuste a data final para encerrá-lo.' using errcode = '23503';
  end if;
  return old;
end;
$$;

drop trigger if exists product_lots_guard on public.product_lots;
create trigger product_lots_guard before delete on public.product_lots
  for each row execute function public.product_lots_guard();

-- Kit só aponta para produtos simples
create or replace function public.kit_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.products where id = new.kit_id and kind = 'kit') then
    raise exception 'Só produtos do tipo kit têm itens.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.products where id = new.product_id and kind = 'simple') then
    raise exception 'Um kit só pode conter produtos simples.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists kit_items_guard on public.kit_items;
create trigger kit_items_guard before insert or update on public.kit_items
  for each row execute function public.kit_items_guard();

-- Ajuste de estoque feito à mão no cadastro da variação vira movimentação
create or replace function public.product_variants_stock_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := case when exists (select 1 from public.profiles where id = auth.uid()) then auth.uid() end;
begin
  -- baixas/devoluções de pedidos já registram a própria movimentação
  if coalesce(current_setting('app.counter_update', true), '') = 'on' then
    return null;
  end if;
  if tg_op = 'INSERT' and new.stock > 0 then
    insert into public.stock_movements (variant_id, quantity, reason, actor_id, note)
    values (new.id, new.stock, 'initial', v_actor, 'Estoque inicial');
  elsif tg_op = 'UPDATE' and new.stock <> old.stock then
    insert into public.stock_movements (variant_id, quantity, reason, actor_id, note)
    values (new.id, new.stock - old.stock, 'adjustment', v_actor, 'Ajuste no cadastro do produto');
  end if;
  return null;
end;
$$;

drop trigger if exists product_variants_stock_log on public.product_variants;
create trigger product_variants_stock_log after insert or update of stock on public.product_variants
  for each row execute function public.product_variants_stock_log();

drop trigger if exists shop_settings_touch on public.shop_settings;
create or replace function public.shop_settings_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.id := 1;
  new.updated_at := now();
  new.updated_by := case when exists (select 1 from public.profiles where id = auth.uid()) then auth.uid() end;
  return new;
end;
$$;
create trigger shop_settings_touch before update on public.shop_settings
  for each row execute function public.shop_settings_touch();

-- ---------------------------------------------------------------------
-- Auditoria do catálogo (função genérica da 0009)
-- ---------------------------------------------------------------------
drop trigger if exists audit_products on public.products;
create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.audit_generic('product', 'name');

drop trigger if exists audit_product_variants on public.product_variants;
create trigger audit_product_variants after insert or update or delete on public.product_variants
  for each row execute function public.audit_generic('product_variant', 'name');

drop trigger if exists audit_product_lots on public.product_lots;
create trigger audit_product_lots after insert or update or delete on public.product_lots
  for each row execute function public.audit_generic('product_lot', 'name');

drop trigger if exists audit_shop_settings on public.shop_settings;
create trigger audit_shop_settings after update on public.shop_settings
  for each row execute function public.audit_generic('shop_settings', 'whatsapp_number');

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------

-- Lote vigente de um produto (null = nenhum à venda agora)
create or replace function public.product_current_lot(p_product_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
  from public.product_lots l
  where l.product_id = p_product_id
    and (l.starts_at is null or l.starts_at <= now())
    and (l.ends_at is null or l.ends_at > now())
    and (l.quantity_limit is null or l.sold_count < l.quantity_limit)
  order by l.position, l.created_at
  limit 1;
$$;

-- Nome do status em português (mensagens de erro)
create or replace function public.order_status_label(p_status public.order_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'pending' then 'Aguardando pagamento'
    when 'paid' then 'Pago'
    when 'ready' then 'Pronto para retirada'
    when 'picked_up' then 'Retirado'
    when 'cancelled' then 'Cancelado'
    when 'refunded' then 'Reembolsado'
  end;
$$;

-- Pode ver o pedido? (dono ou equipe com orders.view)
create or replace function public.can_view_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and (o.user_id = auth.uid() or public.has_permission('orders.view'))
  );
$$;

-- Equipe ativa que tem uma permissão (para avisar sobre pedido novo)
create or replace function public.staff_with_permission(p_key text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.is_staff and p.is_active and not p.is_banned
    and (
      r.is_system
      or exists (
        select 1 from public.role_permissions rp
        join public.permissions perm on perm.id = rp.permission_id
        where rp.role_id = r.id and perm.key = p_key
      )
    );
$$;

-- ---------------------------------------------------------------------
-- Catálogo público em uma chamada (só produtos ativos e campos públicos)
-- p_slug: um produto só (página do produto) ou null (vitrine)
-- ---------------------------------------------------------------------
create or replace function public.shop_catalog(p_slug text default null)
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
      -- próximo lote (para mostrar "depois: R$ X")
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
    where p.is_active
      and (p_slug is null or p.slug = p_slug)
  ) s;
$$;

-- ---------------------------------------------------------------------
-- Criar pedido
-- p_items: [{ product_id, quantity, variant_id?, parts?: [{product_id, variant_id}], holder_names?: [] }]
--   simples: variant_id obrigatório
--   kit:     parts com uma variação para cada produto do kit
-- Se a quantidade passar do que resta no lote vigente, o restante vai
-- para o próximo lote (item dividido em duas linhas, com preços diferentes).
-- ---------------------------------------------------------------------
create or replace function public.create_order(p_items jsonb, p_phone text, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_profile   public.profiles%rowtype;
  v_phone     text := public.normalize_phone(p_phone);
  v_order     public.orders%rowtype;
  v_item      jsonb;
  v_product   public.products%rowtype;
  v_qty       integer;
  v_left      integer;
  v_chunk     integer;
  v_lot       public.product_lots%rowtype;
  v_item_id   uuid;
  v_names     text[];
  v_offset    integer;
  v_total     numeric(10, 2) := 0;
  v_count     integer := 0;
  v_parts     jsonb;      -- [{variant_id, per_unit}]
  v_part      jsonb;
  v_variant   public.product_variants%rowtype;
  v_comp      record;
  v_chosen    uuid;
  v_guard     integer;
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
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Seu carrinho está vazio.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'Muitos itens em um só pedido (máximo 30).' using errcode = 'P0001';
  end if;

  insert into public.orders (user_id, customer_name, customer_phone, notes)
  values (v_uid, left(coalesce(v_profile.full_name, v_profile.username), 80), v_phone, nullif(left(trim(coalesce(p_notes, '')), 500), ''))
  returning * into v_order;

  -- estoque/lote mudam aqui sem gerar log de auditoria ou movimentação genérica
  perform set_config('app.counter_update', 'on', true);

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
      where id = nullif(v_item ->> 'product_id', '')::uuid and is_active;
    if not found then
      raise exception 'Um dos produtos não está mais disponível.' using errcode = 'P0001';
    end if;

    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 50 then
      raise exception 'Quantidade inválida para %.', v_product.name using errcode = 'P0001';
    end if;

    -- Nomes de quem vai usar (opcional, só se o produto pede)
    v_names := '{}';
    if v_product.ask_holder_name and jsonb_typeof(v_item -> 'holder_names') = 'array' then
      select coalesce(array_agg(left(trim(n), 80)), '{}') into v_names
      from jsonb_array_elements_text(v_item -> 'holder_names') as n
      where trim(n) <> '';
      if cardinality(v_names) > v_qty then
        raise exception 'Mais nomes do que unidades em %.', v_product.name using errcode = 'P0001';
      end if;
    end if;

    -- Monta a lista de variações a baixar por unidade
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

    -- Divide a quantidade entre os lotes vigentes
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
      -- outro pedido esgotou o lote enquanto esperávamos a trava: procura o próximo
      if v_chunk <= 0 then
        continue;
      end if;

      update public.product_lots set sold_count = sold_count + v_chunk where id = v_lot.id;

      insert into public.order_items (order_id, product_id, product_name, product_kind, lot_id, lot_name, unit_price, quantity, holder_names)
      values (v_order.id, v_product.id, v_product.name, v_product.kind, v_lot.id, v_lot.name, v_lot.price, v_chunk,
              coalesce(v_names[v_offset + 1 : v_offset + v_chunk], '{}'))
      returning id into v_item_id;

      -- Baixa o estoque de cada variação envolvida
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
        values (v_variant.id, -(v_chunk * (v_part ->> 'per_unit')::integer), 'order', v_order.id, v_uid);
      end loop;

      v_total := v_total + v_lot.price * v_chunk;
      v_count := v_count + v_chunk;
      v_offset := v_offset + v_chunk;
      v_left := v_left - v_chunk;
    end loop;
  end loop;

  perform set_config('app.counter_update', 'off', true);

  update public.orders set total = v_total, item_count = v_count where id = v_order.id;

  insert into public.order_status_history (order_id, from_status, to_status, actor_id)
  values (v_order.id, null, 'pending', v_uid);

  -- Avisa a equipe que acompanha os pedidos
  insert into public.notifications (user_id, type, actor_id, order_id, meta)
  select s, 'order_created', v_uid, v_order.id,
         jsonb_build_object('number', v_order.number, 'total', v_total)
  from public.staff_with_permission('orders.view') s
  where s <> v_uid;

  return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'total', v_total);
end;
$$;

-- ---------------------------------------------------------------------
-- Mudança de status (interna): valida a transição, devolve estoque,
-- grava datas, histórico, auditoria e avisa o cliente.
-- ---------------------------------------------------------------------
create or replace function public.apply_order_status(
  p_order_id uuid, p_status public.order_status, p_note text, p_payment_method text
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.orders%rowtype;
  v_actor   uuid := case when exists (select 1 from public.profiles where id = auth.uid()) then auth.uid() end;
  v_allowed public.order_status[];
  v_part    record;
  v_item    record;
  v_note    text := nullif(left(trim(coalesce(p_note, '')), 500), '');
  v_from    public.order_status;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;
  if v_order.status = p_status then
    return v_order;
  end if;
  v_from := v_order.status;

  -- Cancelado e reembolsado são finais. Entre os demais dá para voltar
  -- um passo (corrigir engano), sempre com histórico.
  v_allowed := case v_order.status
    when 'pending'   then array['paid', 'cancelled']::public.order_status[]
    when 'paid'      then array['pending', 'ready', 'picked_up', 'cancelled', 'refunded']::public.order_status[]
    when 'ready'     then array['paid', 'picked_up', 'cancelled', 'refunded']::public.order_status[]
    when 'picked_up' then array['ready', 'refunded']::public.order_status[]
    else array[]::public.order_status[]
  end;
  if not (p_status = any (v_allowed)) then
    raise exception 'Não é possível mudar o pedido de "%" para "%".',
      public.order_status_label(v_order.status), public.order_status_label(p_status) using errcode = 'P0001';
  end if;

  if p_payment_method is not null and p_payment_method not in ('pix', 'dinheiro', 'cartao', 'outro') then
    raise exception 'Forma de pagamento inválida.' using errcode = 'P0001';
  end if;
  if p_status = 'paid' and v_order.status = 'pending' and coalesce(p_payment_method, v_order.payment_method) is null then
    raise exception 'Informe a forma de pagamento.' using errcode = 'P0001';
  end if;

  -- Cancelar/reembolsar antes da retirada devolve estoque e vaga no lote
  if p_status in ('cancelled', 'refunded') and v_order.status <> 'picked_up' then
    perform set_config('app.counter_update', 'on', true);
    for v_part in
      select pa.variant_id, pa.quantity from public.order_item_parts pa
      join public.order_items oi on oi.id = pa.order_item_id
      where oi.order_id = v_order.id and pa.variant_id is not null
    loop
      update public.product_variants set stock = stock + v_part.quantity where id = v_part.variant_id;
      insert into public.stock_movements (variant_id, quantity, reason, order_id, actor_id)
      values (v_part.variant_id, v_part.quantity, 'order_return', v_order.id, v_actor);
    end loop;
    for v_item in
      select lot_id, sum(quantity)::integer as qty from public.order_items
      where order_id = v_order.id and lot_id is not null group by lot_id
    loop
      update public.product_lots set sold_count = greatest(sold_count - v_item.qty, 0) where id = v_item.lot_id;
    end loop;
    perform set_config('app.counter_update', 'off', true);
  end if;

  update public.orders set
    status         = p_status,
    payment_method = coalesce(p_payment_method, payment_method),
    paid_at        = case when p_status = 'paid' then coalesce(paid_at, now())
                          when p_status = 'pending' then null else paid_at end,
    ready_at       = case when p_status = 'ready' then now() when p_status in ('pending', 'paid') then null else ready_at end,
    picked_up_at   = case when p_status = 'picked_up' then now() when p_status in ('pending', 'paid', 'ready') then null else picked_up_at end,
    cancelled_at   = case when p_status = 'cancelled' then now() else cancelled_at end,
    refunded_at    = case when p_status = 'refunded' then now() else refunded_at end
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, note, actor_id)
  values (v_order.id, v_from, p_status, v_note, v_actor);

  perform public.log_audit('order.status', 'order', v_order.id::text,
    jsonb_build_object('label', '#' || v_order.number, 'to', p_status, 'note', v_note));

  -- Avisa o cliente (se não foi ele mesmo quem mudou)
  if v_order.user_id is not null and v_order.user_id is distinct from v_actor then
    insert into public.notifications (user_id, type, actor_id, order_id, meta)
    values (v_order.user_id, 'order_status', v_actor, v_order.id,
            jsonb_build_object('number', v_order.number, 'status', p_status));
  end if;

  return v_order;
end;
$$;

-- Cliente cancela o próprio pedido enquanto aguarda pagamento
create or replace function public.cancel_my_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.orders where id = p_order_id and user_id = auth.uid() and auth.uid() is not null
  ) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if (select status from public.orders where id = p_order_id) <> 'pending' then
    raise exception 'Só dá para cancelar pelo site enquanto o pedido aguarda pagamento. Fale com o bloco pelo WhatsApp.' using errcode = 'P0001';
  end if;
  perform public.apply_order_status(p_order_id, 'cancelled', 'Cancelado pelo cliente', null);

  -- Avisa a equipe
  insert into public.notifications (user_id, type, actor_id, order_id, meta)
  select s, 'order_status', auth.uid(), o.id,
         jsonb_build_object('number', o.number, 'status', 'cancelled', 'by_customer', true)
  from public.orders o, public.staff_with_permission('orders.view') s
  where o.id = p_order_id and s <> auth.uid();
end;
$$;

-- Equipe muda o status
create or replace function public.admin_set_order_status(
  p_order_id uuid, p_status public.order_status, p_note text default null, p_payment_method text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('orders.manage');
  perform public.apply_order_status(p_order_id, p_status, p_note, p_payment_method);
end;
$$;

-- Resumo por status no período (lista de pedidos do admin)
create or replace function public.admin_orders_summary(p_from timestamptz default null, p_to timestamptz default null)
returns table (status public.order_status, total_orders integer, total_amount numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission('orders.view');
  return query
    select o.status, count(*)::integer, coalesce(sum(o.total), 0)::numeric
    from public.orders o
    where (p_from is null or o.created_at >= p_from)
      and (p_to is null or o.created_at <= p_to)
    group by o.status;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.shop_settings        enable row level security;
alter table public.products             enable row level security;
alter table public.product_images       enable row level security;
alter table public.product_variants     enable row level security;
alter table public.product_lots         enable row level security;
alter table public.kit_items            enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_item_parts     enable row level security;
alter table public.order_status_history enable row level security;
alter table public.stock_movements      enable row level security;

-- Configurações da loja: leitura pública; alteração com products.manage
drop policy if exists shop_settings_select on public.shop_settings;
create policy shop_settings_select on public.shop_settings for select to anon, authenticated using (true);
drop policy if exists shop_settings_update on public.shop_settings;
create policy shop_settings_update on public.shop_settings for update to authenticated
  using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

-- Catálogo: público vê produtos ativos (e o que pertence a eles);
-- a equipe da loja/pedidos vê tudo; só products.manage altera.
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to anon, authenticated
  using (is_active or public.has_any_permission(array['products.manage', 'orders.view']));
drop policy if exists products_write on public.products;
create policy products_write on public.products for all to authenticated
  using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

drop policy if exists product_images_select on public.product_images;
create policy product_images_select on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active)
         or public.has_any_permission(array['products.manage', 'orders.view']));
drop policy if exists product_images_write on public.product_images;
create policy product_images_write on public.product_images for all to authenticated
  using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

drop policy if exists product_variants_select on public.product_variants;
create policy product_variants_select on public.product_variants for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active)
         or public.has_any_permission(array['products.manage', 'orders.view']));
drop policy if exists product_variants_write on public.product_variants;
create policy product_variants_write on public.product_variants for all to authenticated
  using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

drop policy if exists product_lots_select on public.product_lots;
create policy product_lots_select on public.product_lots for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active)
         or public.has_any_permission(array['products.manage', 'orders.view']));
drop policy if exists product_lots_write on public.product_lots;
create policy product_lots_write on public.product_lots for all to authenticated
  using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));
-- o contador de vendidos do lote só muda pelos pedidos
revoke update on public.product_lots from anon, authenticated;
grant update (name, price, starts_at, ends_at, quantity_limit, position) on public.product_lots to authenticated;
revoke insert on public.product_lots from anon, authenticated;
grant insert (product_id, name, price, starts_at, ends_at, quantity_limit, position) on public.product_lots to authenticated;

drop policy if exists kit_items_select on public.kit_items;
create policy kit_items_select on public.kit_items for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = kit_id and p.is_active)
         or public.has_any_permission(array['products.manage', 'orders.view']));
drop policy if exists kit_items_write on public.kit_items;
create policy kit_items_write on public.kit_items for all to authenticated
  using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

-- Pedidos: o dono e quem tem orders.view leem; NINGUÉM grava direto
-- (só pelas funções create_order / cancel_my_order / admin_set_order_status)
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('orders.view'));

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select to authenticated
  using (public.can_view_order(order_id));

drop policy if exists order_item_parts_select on public.order_item_parts;
create policy order_item_parts_select on public.order_item_parts for select to authenticated
  using (exists (select 1 from public.order_items oi where oi.id = order_item_id and public.can_view_order(oi.order_id)));

drop policy if exists order_status_history_select on public.order_status_history;
create policy order_status_history_select on public.order_status_history for select to authenticated
  using (public.can_view_order(order_id));

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.has_permission('products.manage'));

revoke insert, update, delete on public.orders, public.order_items, public.order_item_parts,
  public.order_status_history, public.stock_movements from anon, authenticated;
revoke all on public.orders, public.order_items, public.order_item_parts,
  public.order_status_history, public.stock_movements from anon;
grant select on public.orders, public.order_items, public.order_item_parts,
  public.order_status_history, public.stock_movements to authenticated;
-- O token do QR não sai pela API de tabela (a Fase 7 lê por função própria)
revoke select on public.orders from authenticated;
grant select (id, number, user_id, status, channel, customer_name, customer_phone, notes, total, item_count,
  payment_method, created_at, updated_at, paid_at, ready_at, picked_up_at, cancelled_at, refunded_at)
  on public.orders to authenticated;

-- ---------------------------------------------------------------------
-- Storage: fotos dos produtos
--   product-images/products/{product_id}/{uuid}.webp  (até 5 MB)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_select_staff" on storage.objects;
create policy "product_images_select_staff" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.has_permission('products.manage'));

drop policy if exists "product_images_insert_staff" on storage.objects;
create policy "product_images_insert_staff" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = 'products'
    and public.has_permission('products.manage')
  );

drop policy if exists "product_images_delete_staff" on storage.objects;
create policy "product_images_delete_staff" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_permission('products.manage'));

-- ---------------------------------------------------------------------
-- Privilégios de execução
-- ---------------------------------------------------------------------
revoke execute on function public.products_guard() from public, anon, authenticated;
revoke execute on function public.product_variants_guard() from public, anon, authenticated;
revoke execute on function public.product_lots_guard() from public, anon, authenticated;
revoke execute on function public.kit_items_guard() from public, anon, authenticated;
revoke execute on function public.product_variants_stock_log() from public, anon, authenticated;
revoke execute on function public.shop_settings_touch() from public, anon, authenticated;
revoke execute on function public.staff_with_permission(text) from public, anon, authenticated;
revoke execute on function public.apply_order_status(uuid, public.order_status, text, text) from public, anon, authenticated;

grant execute on function public.product_current_lot(uuid) to anon, authenticated;
grant execute on function public.can_view_order(uuid) to authenticated;
grant execute on function public.shop_catalog(text) to anon, authenticated;
revoke execute on function public.create_order(jsonb, text, text) from public, anon;
grant execute on function public.create_order(jsonb, text, text) to authenticated;
revoke execute on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;
revoke execute on function public.admin_set_order_status(uuid, public.order_status, text, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, public.order_status, text, text) to authenticated;
revoke execute on function public.admin_orders_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_orders_summary(timestamptz, timestamptz) to authenticated;
