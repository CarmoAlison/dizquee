-- =====================================================================
-- 0013 - Fase 8: financeiro do bloco
--   * categorias financeiras e lançamentos (receitas e despesas) com
--     status a pagar/pago (ou a receber/recebido)
--   * lançamentos automáticos: pedido pago -> receita; reembolso -> estorno;
--     cancelado depois de pago -> receita removida; compra de fornecedor ->
--     despesa (sincronizada com a compra)
--   * backfill dos pedidos e compras que já existem
--   * RPCs de resumo, série temporal e vendas por produto (com custo e lucro)
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, description) values
  ('finance.view',   'finance', 'Ver o financeiro, relatórios e exportar (CSV, Excel, PDF)'),
  ('finance.manage', 'finance', 'Lançar, editar e excluir receitas e despesas; marcar como pago; gerenciar categorias')
on conflict (key) do update set module = excluded.module, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and p.key in ('finance.view', 'finance.manage')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.finance_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 2 and 60),
  type       text not null check (type in ('income', 'expense')),
  color      text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  -- categorias usadas pelos lançamentos automáticos (não podem ser excluídas)
  system_key text unique check (system_key in ('sales', 'purchases', 'refunds')),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (type, name)
);

create table if not exists public.finance_entries (
  id             uuid primary key default gen_random_uuid(),
  type           text not null check (type in ('income', 'expense')),
  category_id    uuid not null references public.finance_categories(id) on delete restrict,
  description    text not null check (char_length(trim(description)) between 2 and 200),
  amount         numeric(12, 2) not null check (amount > 0),
  status         text not null default 'paid' check (status in ('pending', 'paid')),
  due_date       date,
  paid_at        date,
  -- data de referência dos relatórios: pagamento (pago) ou vencimento (pendente)
  ref_date       date generated always as (case when status = 'paid' then paid_at else due_date end) stored,
  payment_method text check (payment_method in ('pix', 'dinheiro', 'cartao', 'transferencia', 'boleto', 'outro')),
  notes          text check (char_length(notes) <= 500),
  source         text not null default 'manual' check (source in ('manual', 'order', 'refund', 'purchase')),
  order_id       uuid references public.orders(id) on delete set null,
  purchase_id    uuid references public.purchases(id) on delete cascade,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((status = 'paid' and paid_at is not null) or (status = 'pending' and due_date is not null))
);
create index if not exists finance_entries_ref_idx on public.finance_entries (ref_date desc);
create index if not exists finance_entries_category_idx on public.finance_entries (category_id);
create index if not exists finance_entries_status_idx on public.finance_entries (status, due_date);
create unique index if not exists finance_entries_order_uq on public.finance_entries (order_id) where source = 'order';
create unique index if not exists finance_entries_refund_uq on public.finance_entries (order_id) where source = 'refund';
create unique index if not exists finance_entries_purchase_uq on public.finance_entries (purchase_id) where source = 'purchase';

-- Categorias iniciais
insert into public.finance_categories (name, type, system_key, position, color) values
  ('Venda de produtos', 'income', 'sales', 0, '#1B7F3B'),
  ('Patrocínio', 'income', null, 1, '#AB00B3'),
  ('Outras receitas', 'income', null, 9, null),
  ('Compras de fornecedores', 'expense', 'purchases', 0, '#660385'),
  ('Estornos e reembolsos', 'expense', 'refunds', 1, '#B3261E'),
  ('Banda e músicos', 'expense', null, 2, null),
  ('Trio elétrico e som', 'expense', null, 3, null),
  ('Segurança', 'expense', null, 4, null),
  ('Licenças e taxas', 'expense', null, 5, null),
  ('Divulgação', 'expense', null, 6, null),
  ('Outras despesas', 'expense', null, 9, null)
on conflict (type, name) do nothing;

-- ---------------------------------------------------------------------
-- Regras dos lançamentos
-- ---------------------------------------------------------------------
create or replace function public.finance_entries_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, case when exists (select 1 from public.profiles where id = auth.uid()) then auth.uid() end);
  end if;
  new.updated_at := now();
  -- pago sem data = hoje; pendente sem vencimento = hoje
  if new.status = 'paid' and new.paid_at is null then
    new.paid_at := current_date;
  end if;
  if new.status = 'pending' then
    new.paid_at := null;
    new.due_date := coalesce(new.due_date, current_date);
  end if;
  -- a categoria precisa ser do mesmo tipo (receita/despesa)
  if not exists (select 1 from public.finance_categories c where c.id = new.category_id and c.type = new.type) then
    raise exception 'A categoria não combina com o tipo do lançamento.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists finance_entries_before on public.finance_entries;
create trigger finance_entries_before before insert or update on public.finance_entries
  for each row execute function public.finance_entries_before();

-- Categoria de sistema não é excluída
create or replace function public.finance_categories_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.system_key is not null then
      raise exception 'Esta categoria é usada pelos lançamentos automáticos e não pode ser excluída.' using errcode = '42501';
    end if;
    if exists (select 1 from public.finance_entries where category_id = old.id) then
      raise exception 'Há lançamentos nesta categoria. Mude-os de categoria antes de excluir.' using errcode = '23503';
    end if;
    return old;
  end if;
  if new.system_key is distinct from old.system_key or (old.system_key is not null and new.type <> old.type) then
    raise exception 'Categoria de sistema: só o nome e a cor podem mudar.' using errcode = '42501';
  end if;
  if new.type <> old.type and exists (select 1 from public.finance_entries where category_id = old.id) then
    raise exception 'Há lançamentos nesta categoria: não dá para trocar o tipo.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists finance_categories_guard on public.finance_categories;
create trigger finance_categories_guard before update or delete on public.finance_categories
  for each row execute function public.finance_categories_guard();

-- ---------------------------------------------------------------------
-- Automáticos: pedidos
-- ---------------------------------------------------------------------
create or replace function public.finance_category_id(p_key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.finance_categories where system_key = p_key;
$$;

create or replace function public.finance_sync_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid_states public.order_status[] := array['paid', 'ready', 'picked_up']::public.order_status[];
  v_was_paid boolean := tg_op = 'UPDATE' and old.status = any (v_paid_states);
  v_desc text := 'Pedido #' || new.number || case when new.channel = 'presencial' then ' (venda presencial)' else ' (loja online)' end;
  v_method text := case when new.payment_method in ('pix', 'dinheiro', 'cartao', 'outro') then new.payment_method end;
begin
  if new.status = any (v_paid_states) or new.status = 'refunded' then
    -- receita da venda (também fica em pedidos reembolsados: o estorno é outro lançamento)
    if new.total > 0 and (new.status <> 'refunded' or v_was_paid or new.paid_at is not null) then
      insert into public.finance_entries (type, category_id, description, amount, status, paid_at, payment_method, source, order_id, created_by)
      values ('income', public.finance_category_id('sales'), v_desc, new.total, 'paid',
              coalesce(new.paid_at, now())::date, v_method, 'order', new.id, null)
      on conflict (order_id) where source = 'order' do update set
        amount = excluded.amount,
        payment_method = excluded.payment_method,
        description = excluded.description;
    end if;
  end if;

  -- voltou para "aguardando" ou foi cancelado: a venda não aconteceu
  if new.status in ('pending', 'cancelled') then
    delete from public.finance_entries where order_id = new.id and source = 'order';
  end if;

  -- reembolso de pedido pago: despesa de estorno
  if new.status = 'refunded' and (tg_op = 'INSERT' or old.status <> 'refunded') and new.total > 0
     and exists (select 1 from public.finance_entries where order_id = new.id and source = 'order') then
    insert into public.finance_entries (type, category_id, description, amount, status, paid_at, payment_method, source, order_id)
    values ('expense', public.finance_category_id('refunds'), 'Reembolso do pedido #' || new.number, new.total, 'paid',
            coalesce(new.refunded_at, now())::date, v_method, 'refund', new.id)
    on conflict (order_id) where source = 'refund' do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists finance_sync_order on public.orders;
create trigger finance_sync_order after update of status, payment_method, total on public.orders
  for each row execute function public.finance_sync_order();

-- ---------------------------------------------------------------------
-- Automáticos: compras de fornecedor (despesa espelha a compra)
-- ---------------------------------------------------------------------
create or replace function public.finance_sync_purchase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.total <= 0 then
    return null; -- a compra recebe o total logo depois de criada
  end if;
  insert into public.finance_entries (type, category_id, description, amount, status, due_date, paid_at, notes, source, purchase_id, created_by)
  values ('expense', public.finance_category_id('purchases'), 'Compra de ' || new.supplier_name, new.total,
          new.payment_status, coalesce(new.due_date, new.purchased_at), new.paid_at, new.notes, 'purchase', new.id, new.created_by)
  on conflict (purchase_id) where source = 'purchase' do update set
    description = excluded.description,
    amount = excluded.amount,
    status = excluded.status,
    due_date = excluded.due_date,
    paid_at = excluded.paid_at,
    notes = excluded.notes;
  return null;
end;
$$;

drop trigger if exists finance_sync_purchase on public.purchases;
create trigger finance_sync_purchase after insert or update on public.purchases
  for each row execute function public.finance_sync_purchase();

-- ---------------------------------------------------------------------
-- Backfill (pedidos e compras de antes desta migração)
-- ---------------------------------------------------------------------
insert into public.finance_entries (type, category_id, description, amount, status, paid_at, payment_method, source, order_id)
select 'income', public.finance_category_id('sales'),
       'Pedido #' || o.number || case when o.channel = 'presencial' then ' (venda presencial)' else ' (loja online)' end,
       o.total, 'paid', coalesce(o.paid_at, o.updated_at)::date,
       case when o.payment_method in ('pix', 'dinheiro', 'cartao', 'outro') then o.payment_method end, 'order', o.id
from public.orders o
where o.total > 0 and (o.status in ('paid', 'ready', 'picked_up') or (o.status = 'refunded' and o.paid_at is not null))
on conflict (order_id) where source = 'order' do nothing;

insert into public.finance_entries (type, category_id, description, amount, status, paid_at, source, order_id)
select 'expense', public.finance_category_id('refunds'), 'Reembolso do pedido #' || o.number, o.total, 'paid',
       coalesce(o.refunded_at, o.updated_at)::date, 'refund', o.id
from public.orders o
where o.status = 'refunded' and o.paid_at is not null and o.total > 0
on conflict (order_id) where source = 'refund' do nothing;

insert into public.finance_entries (type, category_id, description, amount, status, due_date, paid_at, notes, source, purchase_id, created_by)
select 'expense', public.finance_category_id('purchases'), 'Compra de ' || p.supplier_name, p.total, p.payment_status,
       coalesce(p.due_date, p.purchased_at), p.paid_at, p.notes, 'purchase', p.id, p.created_by
from public.purchases p
where p.total > 0
on conflict (purchase_id) where source = 'purchase' do nothing;

-- ---------------------------------------------------------------------
-- Funções (finance.view / finance.manage)
-- ---------------------------------------------------------------------

-- Marca um lançamento como pago / pendente. Para a despesa de uma compra,
-- muda a própria compra (que sincroniza o lançamento).
create or replace function public.finance_set_status(p_entry_id uuid, p_status text, p_date date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.finance_entries%rowtype;
begin
  perform public.assert_permission('finance.manage');
  if p_status not in ('pending', 'paid') then
    raise exception 'Situação inválida.' using errcode = 'P0001';
  end if;
  select * into v_entry from public.finance_entries where id = p_entry_id;
  if not found then
    raise exception 'Lançamento não encontrado.' using errcode = 'P0001';
  end if;
  if v_entry.source in ('order', 'refund') then
    raise exception 'Lançamento de pedido: mude o status no próprio pedido.' using errcode = 'P0001';
  end if;
  if v_entry.source = 'purchase' then
    update public.purchases set
      payment_status = p_status,
      paid_at = case when p_status = 'paid' then coalesce(p_date, current_date) end
    where id = v_entry.purchase_id;
    return;
  end if;
  update public.finance_entries set
    status = p_status,
    paid_at = case when p_status = 'paid' then coalesce(p_date, current_date) end,
    due_date = case when p_status = 'pending' then coalesce(due_date, p_date, current_date) else due_date end
  where id = p_entry_id;
end;
$$;

-- Resumo do período (pagos pela data de pagamento; pendentes pelo vencimento)
create or replace function public.finance_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_any_permission(array['finance.view', 'finance.manage']) then
    raise exception 'Sem permissão (finance.view).' using errcode = '42501';
  end if;
  return (
    with e as (
      select * from public.finance_entries
      where ref_date between p_from and p_to
    )
    select jsonb_build_object(
      'income_paid',      coalesce((select sum(amount) from e where type = 'income' and status = 'paid'), 0),
      'expense_paid',     coalesce((select sum(amount) from e where type = 'expense' and status = 'paid'), 0),
      'income_pending',   coalesce((select sum(amount) from e where type = 'income' and status = 'pending'), 0),
      'expense_pending',  coalesce((select sum(amount) from e where type = 'expense' and status = 'pending'), 0),
      -- vencidos (qualquer data até hoje, não só no período)
      'overdue_expense',  coalesce((select sum(amount) from public.finance_entries where type = 'expense' and status = 'pending' and due_date < current_date), 0),
      'overdue_income',   coalesce((select sum(amount) from public.finance_entries where type = 'income' and status = 'pending' and due_date < current_date), 0),
      'overdue_count',    (select count(*) from public.finance_entries where status = 'pending' and due_date < current_date),
      'entries',          (select count(*) from e),
      'by_category', coalesce((
        select jsonb_agg(jsonb_build_object('category_id', c.id, 'name', c.name, 'type', c.type, 'color', c.color,
                                            'paid', x.paid, 'pending', x.pending) order by c.type desc, coalesce(x.paid, 0) + coalesce(x.pending, 0) desc)
        from (
          select category_id,
                 sum(amount) filter (where status = 'paid') as paid,
                 sum(amount) filter (where status = 'pending') as pending
          from e group by category_id
        ) x join public.finance_categories c on c.id = x.category_id
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Entradas e saídas pagas por dia / semana / mês
create or replace function public.finance_timeseries(p_from date, p_to date, p_group text default 'day')
returns table (bucket date, income numeric, expense numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_unit text := case when p_group in ('week', 'month') then p_group else 'day' end;
begin
  if not public.has_any_permission(array['finance.view', 'finance.manage']) then
    raise exception 'Sem permissão (finance.view).' using errcode = '42501';
  end if;
  return query
    with buckets as (
      select generate_series(date_trunc(v_unit, p_from::timestamp), date_trunc(v_unit, p_to::timestamp), ('1 ' || v_unit)::interval)::date as b
    )
    select b.b,
           coalesce(sum(e.amount) filter (where e.type = 'income'), 0)::numeric,
           coalesce(sum(e.amount) filter (where e.type = 'expense'), 0)::numeric
    from buckets b
    left join public.finance_entries e
      on e.status = 'paid' and e.paid_at between p_from and p_to
     and date_trunc(v_unit, e.paid_at::timestamp)::date = b.b
    group by b.b
    order by b.b;
end;
$$;

-- Vendas por produto no período (pedidos pagos, prontos ou retirados,
-- pela data do pagamento). Custo = custo médio atual das variações.
create or replace function public.finance_product_sales(p_from date, p_to date)
returns table (
  product_id uuid, product_name text, product_kind public.product_kind, quantity integer,
  revenue numeric, cost numeric, profit numeric, cost_known boolean, variants jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_any_permission(array['finance.view', 'finance.manage']) then
    raise exception 'Sem permissão (finance.view).' using errcode = '42501';
  end if;
  return query
    with items as (
      select oi.* from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.status in ('paid', 'ready', 'picked_up')
        and o.paid_at::date between p_from and p_to
    ),
    parts as (
      select it.product_id, pa.variant_id, pa.product_name as part_product, pa.variant_name, pa.quantity, vc.avg_cost
      from items it
      join public.order_item_parts pa on pa.order_item_id = it.id
      left join public.variant_costs vc on vc.variant_id = pa.variant_id
    ),
    totals as (
      select it.product_id, max(it.product_name) as product_name, max(it.product_kind::text)::public.product_kind as product_kind,
             sum(it.quantity)::integer as quantity, sum(it.unit_price * it.quantity)::numeric as revenue
      from items it group by it.product_id
    ),
    costs as (
      select pt.product_id, sum(pt.quantity * coalesce(pt.avg_cost, 0))::numeric as cost, bool_and(pt.avg_cost is not null) as cost_known,
             jsonb_agg(jsonb_build_object('product', pt.part_product, 'variant', pt.variant_name, 'quantity', pt.quantity)) as variants
      from parts pt group by pt.product_id
    )
    select t.product_id, t.product_name, t.product_kind, t.quantity, t.revenue,
           coalesce(c.cost, 0), t.revenue - coalesce(c.cost, 0), coalesce(c.cost_known, false),
           -- soma por variação (o agregado acima tem uma linha por item de pedido)
           coalesce((
             select jsonb_agg(jsonb_build_object('product', v.product, 'variant', v.variant, 'quantity', v.qty) order by v.product, v.variant)
             from (
               select x ->> 'product' as product, x ->> 'variant' as variant, sum((x ->> 'quantity')::integer) as qty
               from jsonb_array_elements(c.variants) x group by 1, 2
             ) v
           ), '[]'::jsonb)
    from totals t left join costs c on c.product_id is not distinct from t.product_id
    order by t.revenue desc;
end;
$$;

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
drop trigger if exists audit_finance_categories on public.finance_categories;
create trigger audit_finance_categories after insert or update or delete on public.finance_categories
  for each row execute function public.audit_generic('finance_category', 'name');

-- Só lançamentos manuais (os automáticos já são auditados na origem)
create or replace function public.audit_finance_entries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.finance_entries%rowtype;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
  if v_row.source <> 'manual' and tg_op <> 'UPDATE' then
    return null;
  end if;
  if tg_op = 'UPDATE' and v_row.source <> 'manual' and old.status = new.status then
    return null;
  end if;
  perform public.log_audit('finance_entry.' || lower(tg_op), 'finance_entry', v_row.id::text, jsonb_build_object(
    'label', v_row.description, 'amount', v_row.amount, 'type', v_row.type, 'status', v_row.status));
  return null;
end;
$$;

drop trigger if exists audit_finance_entries on public.finance_entries;
create trigger audit_finance_entries after insert or update or delete on public.finance_entries
  for each row execute function public.audit_finance_entries();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.finance_categories enable row level security;
alter table public.finance_entries    enable row level security;

drop policy if exists finance_categories_select on public.finance_categories;
create policy finance_categories_select on public.finance_categories for select to authenticated
  using (public.has_any_permission(array['finance.view', 'finance.manage']));
drop policy if exists finance_categories_write on public.finance_categories;
create policy finance_categories_write on public.finance_categories for all to authenticated
  using (public.has_permission('finance.manage')) with check (public.has_permission('finance.manage'));
-- system_key só vem da migração
revoke insert, update on public.finance_categories from anon, authenticated;
grant insert (name, type, color, position) on public.finance_categories to authenticated;
grant update (name, type, color, position) on public.finance_categories to authenticated;

drop policy if exists finance_entries_select on public.finance_entries;
create policy finance_entries_select on public.finance_entries for select to authenticated
  using (public.has_any_permission(array['finance.view', 'finance.manage']));

-- Lançamentos manuais: escrita direta com finance.manage. Os automáticos
-- (pedido, estorno, compra) só mudam pela origem ou por finance_set_status.
drop policy if exists finance_entries_insert on public.finance_entries;
create policy finance_entries_insert on public.finance_entries for insert to authenticated
  with check (public.has_permission('finance.manage') and source = 'manual' and order_id is null and purchase_id is null);
drop policy if exists finance_entries_update on public.finance_entries;
create policy finance_entries_update on public.finance_entries for update to authenticated
  using (public.has_permission('finance.manage') and source = 'manual')
  with check (public.has_permission('finance.manage') and source = 'manual' and order_id is null and purchase_id is null);
drop policy if exists finance_entries_delete on public.finance_entries;
create policy finance_entries_delete on public.finance_entries for delete to authenticated
  using (public.has_permission('finance.manage') and source = 'manual');

revoke all on public.finance_categories, public.finance_entries from anon;
-- origem, vínculos e autoria não são definidos pelo navegador
revoke insert, update on public.finance_entries from anon, authenticated;
grant insert (type, category_id, description, amount, status, due_date, paid_at, payment_method, notes)
  on public.finance_entries to authenticated;
grant update (type, category_id, description, amount, status, due_date, paid_at, payment_method, notes)
  on public.finance_entries to authenticated;

-- ---------------------------------------------------------------------
-- Privilégios de execução
-- ---------------------------------------------------------------------
revoke execute on function public.finance_entries_before() from public, anon, authenticated;
revoke execute on function public.finance_categories_guard() from public, anon, authenticated;
revoke execute on function public.finance_sync_order() from public, anon, authenticated;
revoke execute on function public.finance_sync_purchase() from public, anon, authenticated;
revoke execute on function public.audit_finance_entries() from public, anon, authenticated;
revoke execute on function public.finance_category_id(text) from public, anon, authenticated;

revoke execute on function public.finance_set_status(uuid, text, date) from public, anon;
grant execute on function public.finance_set_status(uuid, text, date) to authenticated;
revoke execute on function public.finance_summary(date, date) from public, anon;
grant execute on function public.finance_summary(date, date) to authenticated;
revoke execute on function public.finance_timeseries(date, date, text) from public, anon;
grant execute on function public.finance_timeseries(date, date, text) to authenticated;
revoke execute on function public.finance_product_sales(date, date) from public, anon;
grant execute on function public.finance_product_sales(date, date) to authenticated;
