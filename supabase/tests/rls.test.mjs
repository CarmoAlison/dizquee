// =====================================================================
// Teste local das migrações + RLS (npm run test:db)
// Roda as migrações num Postgres em WebAssembly (PGlite) com stubs
// mínimos do Supabase (auth.uid, storage, papéis anon/authenticated) e
// simula visitante, cliente, banido, editor e Super Admin tentando
// acessar/alterar dados direto no banco (como faria pela API).
// Não substitui o teste no projeto Supabase real, mas pega regressões.
// =====================================================================
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = process.argv[2] || fileURLToPath(new URL('../migrations', import.meta.url))
const db = new PGlite()

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema extensions; create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, phone text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub','')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
  create publication supabase_realtime;
  grant usage on schema public, auth, storage, extensions to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`)

for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  let sql = readFileSync(join(dir, file), 'utf8').replace(/create extension[^;]+;/gi, '')
  try {
    await db.exec(sql)
    console.log('OK  ', file)
  } catch (e) {
    console.log('FAIL', file, '-', e.message)
    process.exit(1)
  }
}
// Rodar de novo para testar idempotência
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(dir, file), 'utf8').replace(/create extension[^;]+;/gi, '')
  try {
    await db.exec(sql)
  } catch (e) {
    console.log('NÃO IDEMPOTENTE', file, '-', e.message)
  }
}
console.log('Idempotência verificada')

// ---------------- helpers ----------------
let failures = 0
const asUser = async (uid, fn) => {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid }) : ''}', false);`)
  await db.exec(uid ? 'set role authenticated' : 'set role anon')
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`)
  }
}
const q = (sql, params) => db.query(sql, params)
async function expectOk(label, fn) {
  try {
    const r = await fn()
    console.log('  ✔', label)
    return r
  } catch (e) {
    failures++
    console.log('  ✘', label, '->', e.message)
  }
}
async function expectFail(label, fn) {
  try {
    const r = await fn()
    // UPDATE/DELETE bloqueados por RLS não dão erro: afetam 0 linhas
    if (r && r.affectedRows === 0) {
      console.log('  ✔', label, '(0 linhas)')
      return
    }
    failures++
    console.log('  ✘', label, '-> deveria falhar, mas passou', JSON.stringify(r?.rows?.slice?.(0, 1) ?? ''))
  } catch (e) {
    console.log('  ✔', label, '->', e.message.slice(0, 90))
  }
}

// ---------------- dados ----------------
const ids = {}
for (const [k, meta] of Object.entries({
  admin: { full_name: 'Admin', username: 'admin', phone: '11999999999', terms_version: '2026-11-13' },
  editor: { full_name: 'Editora', username: 'editora', terms_version: '2026-11-13' },
  cliente: { full_name: 'Cliente', username: 'cliente', phone: '+5511988887777', terms_version: '2026-11-13' },
  outro: { full_name: 'Outro', username: 'cliente' /* duplicado -> null */ },
  banido: { full_name: 'Banido', username: 'banido', terms_version: '2026-11-13' },
})) {
  const r = await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [`${k}@x.com`, meta])
  ids[k] = r.rows[0].id
}
console.log('\nPerfis criados pelo trigger:')
const profs = await q(`select username, phone, terms_version, terms_accepted_at is not null as aceitou from public.profiles order by created_at`)
console.table(profs.rows)

// Super Admin pelo SQL Editor (sem auth.uid)
await q(`update public.profiles set is_staff = true, role_id = (select id from public.roles where name='Super Admin') where id = $1`, [ids.admin])

console.log('\nAdmin:')
await asUser(ids.admin, async () => {
  await expectOk('has_permission(roles.manage)', async () => {
    const r = await q(`select public.has_permission('roles.manage') as ok`)
    if (!r.rows[0].ok) throw new Error('false')
  })
  await expectOk('cria perfil Editor', () => q(`insert into public.roles (name) values ('Editor')`))
  await expectOk('dá posts.create + posts.edit_own ao Editor', () =>
    q(`insert into public.role_permissions select r.id, p.id from public.roles r, public.permissions p where r.name='Editor' and p.key in ('posts.create','posts.edit_own','posts.view_admin')`),
  )
  await expectOk('coloca editora na equipe como Editor', () =>
    q(`update public.profiles set is_staff = true, role_id = (select id from public.roles where name='Editor') where id = $1`, [ids.editor]),
  )
  await expectFail('não altera o próprio role', () => q(`update public.profiles set role_id = null where id = $1`, [ids.admin]))
  await expectFail('não edita perfil de sistema', () => q(`update public.roles set name='X' where is_system`))
  await expectOk('cria categoria', () => q(`insert into public.categories (name, slug) values ('Ensaios','ensaios')`))
  await expectOk('cria post publicado', () =>
    q(`insert into public.posts (title, slug, content, author_id, status) values ('Ensaio geral','ensaio-geral','texto',$1,'published')`, [ids.admin]),
  )
  await expectOk('cria story 24h', () =>
    q(`insert into public.stories (author_id, media_type, storage_path, expires_at) values ($1,'image','stories/a.webp', now())`, [ids.admin]),
  )
  await expectOk('cria destaque e story destaque', async () => {
    const h = await q(`insert into public.highlights (title) values ('Desfile') returning id`)
    await q(`insert into public.stories (author_id, media_type, storage_path, is_highlight, highlight_id) values ($1,'video','stories/b.mp4', true, $2)`, [ids.admin, h.rows[0].id])
  })
  await expectOk('bane usuário', () => q(`update public.profiles set is_banned = true, banned_reason='spam' where id = $1`, [ids.banido]))
  await expectOk('altera identidade visual', () => q(`update public.app_settings set color_primary_1 = '#550077' where id = 1`))
  await expectFail('cor inválida é recusada', () => q(`update public.app_settings set color_accent_1 = 'rosa' where id = 1`))
  await expectOk('métricas', () => q(`select public.admin_metrics_summary()`))
  await expectOk('cadastros por dia', () => q(`select * from public.admin_signups_per_day(7)`))
  await expectOk('atividade recente', () => q(`select * from public.admin_recent_activity(10)`))
})

const superRoleId = (await q(`select id from public.roles where is_system`)).rows[0].id
const postId = (await q(`select id from public.posts limit 1`)).rows[0].id
const storyId = (await q(`select id from public.stories where not is_highlight limit 1`)).rows[0].id

console.log('\nEditora (perfil Editor):')
await asUser(ids.editor, async () => {
  await expectOk('cria post rascunho', () =>
    q(`insert into public.posts (title, slug, author_id) values ('Rascunho da editora','rascunho-editora',$1)`, [ids.editor]),
  )
  await expectFail('não publica sem posts.publish', () =>
    q(`update public.posts set status='published' where slug='rascunho-editora'`),
  )
  await expectFail('não edita post de outra pessoa', () => q(`update public.posts set title='hack' where id=$1`, [postId]))
  await expectFail('não cria categoria', () => q(`insert into public.categories (name, slug) values ('X','x')`))
  await expectFail('não se dá roles.manage', () =>
    q(`insert into public.role_permissions select r.id, p.id from public.roles r, public.permissions p where r.name='Editor' and p.key='roles.manage'`),
  )
  await expectFail('não vê métricas', () => q(`select public.admin_metrics_summary()`))
  await expectFail('não lê audit_logs (0 linhas)', async () => {
    const r = await q(`select * from public.audit_logs`)
    if (r.rows.length === 0) throw new Error('nenhuma linha visível')
    return r
  })
})

console.log('\nCliente:')
await asUser(ids.cliente, async () => {
  await expectOk('curte post publicado', () => q(`insert into public.post_likes (post_id, user_id) values ($1,$2)`, [postId, ids.cliente]))
  await expectFail('não curte em nome de outro', () => q(`insert into public.post_likes (post_id, user_id) values ($1,$2)`, [postId, ids.outro]))
  await expectOk('comenta', () => q(`insert into public.comments (post_id, user_id, content) values ($1,$2,'Que lindo!')`, [postId, ids.cliente]))
  await expectOk('responde (vira 1 nível)', async () => {
    const root = (await q(`select id from public.comments limit 1`)).rows[0].id
    const r1 = await q(`insert into public.comments (post_id, user_id, parent_id, content) values ($1,$2,$3,'resp') returning id`, [postId, ids.cliente, root])
    const r2 = await q(`insert into public.comments (post_id, user_id, parent_id, content) values ($1,$2,$3,'resp2') returning parent_id`, [postId, ids.cliente, r1.rows[0].id])
    if (r2.rows[0].parent_id !== root) throw new Error('não achatou')
  })
  await expectFail('não muda o próprio role_id', () => q(`update public.profiles set role_id = $2, is_staff = true where id=$1`, [ids.cliente, superRoleId]))
  await expectFail('não se desbane/bane', () => q(`update public.profiles set is_banned = true where id=$1`, [ids.cliente]))
  await expectOk('edita o próprio nome', () => q(`update public.profiles set full_name='Cliente Novo' where id=$1`, [ids.cliente]))
  await expectFail('não vê e-mail de outros (profiles)', async () => {
    const r = await q(`select email from public.profiles where id <> $1`, [ids.cliente])
    if (r.rows.length === 0) throw new Error('nenhuma linha visível')
    return r
  })
  await expectOk('vê perfis públicos', () => q(`select username from public.public_profiles`))
  await expectFail('não altera identidade visual', () => q(`update public.app_settings set brand_name = 'Hack' where id = 1`))
  await expectFail('não insere post', () => q(`insert into public.posts (title, slug, author_id) values ('x x x','xxx',$1)`, [ids.cliente]))
  await expectFail('não altera contador direto', () => q(`update public.posts set like_count = 999 where id=$1`, [postId]))
  await expectOk('reage ao story', () => q(`insert into public.story_reactions (story_id, user_id, emoji) values ($1,$2,'🔥')`, [storyId, ids.cliente]))
  await expectFail('emoji fora da lista', () => q(`insert into public.story_reactions (story_id, user_id, emoji) values ($1,$2,'💩')`, [storyId, ids.cliente]))
  await expectOk('registra view', () => q(`select public.register_story_view($1, 'sessao-teste-123')`, [storyId]))
  await expectOk('view duplicada não conta', async () => {
    await q(`select public.register_story_view($1, 'sessao-teste-123')`, [storyId])
  })
  await expectFail('não vê quem viu', () => q(`select * from public.get_story_viewers($1)`, [storyId]))
  await expectFail('não forja notificação', () => q(`insert into public.notifications (user_id, type, actor_id) values ($1,'post_like',$1)`, [ids.admin]))
  await expectFail('só read_at é alterável na notificação', () => q(`update public.notifications set type='post_comment'`))
})

console.log('\nBanido:')
await asUser(ids.banido, async () => {
  await expectFail('não curte', () => q(`insert into public.post_likes (post_id, user_id) values ($1,$2)`, [postId, ids.banido]))
  await expectFail('não comenta', () => q(`insert into public.comments (post_id, user_id, content) values ($1,$2,'oi')`, [postId, ids.banido]))
})

console.log('\nVisitante (anon):')
await asUser(null, async () => {
  await expectOk('vê posts publicados', async () => {
    const r = await q(`select count(*)::int as n from public.posts`)
    if (r.rows[0].n !== 1) throw new Error(`viu ${r.rows[0].n} posts (rascunho vazou?)`)
  })
  await expectOk('lê identidade visual', async () => {
    const r = await q(`select brand_name from public.app_settings`)
    if (r.rows.length !== 1) throw new Error('não leu')
  })
  await expectOk('feed via RPC', () => q(`select * from public.get_feed(null, null, null, 10)`))
  await expectOk('vê stories ativos (destaque)', () => q(`select count(*) from public.stories`))
  await expectOk('view anônima', () => q(`select public.register_story_view((select id from public.stories where is_highlight limit 1), 'anon-session-abc')`))
  await expectFail('não curte', () => q(`insert into public.post_likes (post_id, user_id) values ($1,$2)`, [postId, ids.cliente]))
  await expectFail('não lê profiles', async () => {
    const r = await q(`select * from public.profiles`)
    if (r.rows.length === 0) throw new Error('nenhuma linha visível')
    return r
  })
})

// =====================================================================
// Fase 6: loja e pedidos
// =====================================================================
console.log('\nLoja (admin monta o catálogo):')
{
  const r = await q(`insert into auth.users (email, raw_user_meta_data) values ('atend@x.com', $1) returning id`, [
    { full_name: 'Atendente', username: 'atendente', terms_version: '2026-11-13' },
  ])
  ids.atend = r.rows[0].id
}
const shop = {}
await asUser(ids.admin, async () => {
  await expectOk('configura a loja (WhatsApp)', () => q(`update public.shop_settings set whatsapp_number = '+5511999990000', pickup_info = 'Quadra, sábado' where id = 1`))
  await expectOk('cria abadá com variações e 2 lotes', async () => {
    shop.abada = (await q(`insert into public.products (name, slug, is_active, ask_holder_name) values ('Abadá 2027','abada-2027', true, true) returning id`)).rows[0].id
    shop.abadaP = (await q(`insert into public.product_variants (product_id, name, stock) values ($1,'P',3) returning id`, [shop.abada])).rows[0].id
    shop.abadaM = (await q(`insert into public.product_variants (product_id, name, stock, position) values ($1,'M',2,1) returning id`, [shop.abada])).rows[0].id
    shop.lot1 = (await q(`insert into public.product_lots (product_id, name, price, quantity_limit) values ($1,'1º lote',50,2) returning id`, [shop.abada])).rows[0].id
    await q(`insert into public.product_lots (product_id, name, price, position) values ($1,'2º lote',70,1)`, [shop.abada])
  })
  await expectOk('cria copo e kit (abadá + copo)', async () => {
    shop.copo = (await q(`insert into public.products (name, slug, is_active) values ('Copo','copo', true) returning id`)).rows[0].id
    shop.copoU = (await q(`insert into public.product_variants (product_id, name, stock) values ($1,'Único',10) returning id`, [shop.copo])).rows[0].id
    await q(`insert into public.product_lots (product_id, name, price) values ($1,'Lote único',15)`, [shop.copo])
    shop.kit = (await q(`insert into public.products (name, slug, kind, is_active) values ('Kit folião','kit-foliao','kit', true) returning id`)).rows[0].id
    await q(`insert into public.kit_items (kit_id, product_id, quantity) values ($1,$2,1),($1,$3,1)`, [shop.kit, shop.abada, shop.copo])
    await q(`insert into public.product_lots (product_id, name, price) values ($1,'Kit',60)`, [shop.kit])
  })
  await expectOk('cria produto inativo', () => q(`insert into public.products (name, slug) values ('Rascunho loja','rascunho-loja')`))
  await expectFail('kit não tem variação própria', () => q(`insert into public.product_variants (product_id, name) values ($1,'X')`, [shop.kit]))
  await expectFail('kit não contém kit', () => q(`insert into public.kit_items (kit_id, product_id) values ($1,$1)`, [shop.kit]))
  await expectFail('não mexe no contador do lote', () => q(`update public.product_lots set sold_count = 99 where id = $1`, [shop.lot1]))
  await expectOk('cria perfil Atendimento (orders.view + orders.manage)', async () => {
    await q(`insert into public.roles (name) values ('Atendimento')`)
    await q(`insert into public.role_permissions select r.id, p.id from public.roles r, public.permissions p where r.name='Atendimento' and p.key in ('orders.view','orders.manage')`)
    await q(`update public.profiles set is_staff = true, role_id = (select id from public.roles where name='Atendimento') where id = $1`, [ids.atend])
  })
})

console.log('\nLoja (cliente compra):')
await asUser(ids.cliente, async () => {
  await expectOk('catálogo mostra 3 produtos ativos com preço do lote', async () => {
    const r = (await q(`select public.shop_catalog() as c`)).rows[0].c
    if (r.length !== 3) throw new Error(`viu ${r.length}`)
    const ab = r.find((p) => p.slug === 'abada-2027')
    if (Number(ab.lot.price) !== 50 || ab.lot.remaining !== 2 || Number(ab.next_lot.price) !== 70) throw new Error(JSON.stringify(ab.lot))
  })
  await expectOk('pedido de 3 abadás P divide lotes (2x50 + 1x70) e ignora preço enviado', async () => {
    const items = [{ product_id: shop.abada, variant_id: shop.abadaP, quantity: 3, price: 1, holder_names: ['Ana', 'Bia'] }]
    const r = (await q(`select public.create_order($1, '(11) 98888-7777', 'tamanho certinho') as o`, [JSON.stringify(items)])).rows[0].o
    shop.order1 = r.id
    if (Number(r.total) !== 170) throw new Error(`total ${r.total}`)
  })
  await expectFail('estoque insuficiente (M tem 2)', () =>
    q(`select public.create_order($1, '11988887777')`, [JSON.stringify([{ product_id: shop.abada, variant_id: shop.abadaM, quantity: 3 }])]),
  )
  await expectOk('kit baixa abadá M e copo', async () => {
    const items = [{ product_id: shop.kit, quantity: 1, parts: [{ product_id: shop.abada, variant_id: shop.abadaM }, { product_id: shop.copo, variant_id: shop.copoU }] }]
    const r = (await q(`select public.create_order($1, '11988887777') as o`, [JSON.stringify(items)])).rows[0].o
    shop.order2 = r.id
    if (Number(r.total) !== 60) throw new Error(`total ${r.total}`)
  })
  await expectFail('kit sem escolher variação', () =>
    q(`select public.create_order($1, '11988887777')`, [JSON.stringify([{ product_id: shop.kit, quantity: 1, parts: [] }])]),
  )
  await expectFail('variação de outro produto', () =>
    q(`select public.create_order($1, '11988887777')`, [JSON.stringify([{ product_id: shop.copo, variant_id: shop.abadaM, quantity: 1 }])]),
  )
  await expectFail('telefone inválido', () =>
    q(`select public.create_order($1, '123')`, [JSON.stringify([{ product_id: shop.copo, variant_id: shop.copoU, quantity: 1 }])]),
  )
  await expectFail('não insere pedido direto', () => q(`insert into public.orders (user_id, total) values ($1, 0)`, [ids.cliente]))
  await expectFail('não altera status direto', () => q(`update public.orders set status = 'paid' where id = $1`, [shop.order1]))
  await expectFail('não usa a função da equipe', () => q(`select public.admin_set_order_status($1, 'paid', null, 'pix')`, [shop.order1]))
  await expectFail('não lê o token do QR', () => q(`select pickup_token from public.orders`))
  await expectFail('não vê movimentações de estoque', async () => {
    const r = await q(`select * from public.stock_movements`)
    if (r.rows.length === 0) throw new Error('nenhuma linha visível')
    return r
  })
  await expectOk('vê os próprios pedidos e itens', async () => {
    const r = await q(`select o.number, (select count(*)::int from public.order_items i where i.order_id = o.id) as itens from public.orders o order by o.number`)
    if (r.rows.length !== 2 || r.rows[0].itens !== 2) throw new Error(JSON.stringify(r.rows))
  })
  await expectOk('cancela o pedido 2 (aguardando) e o estoque volta', async () => {
    await q(`select public.cancel_my_order($1)`, [shop.order2])
    const r = await q(`select stock from public.product_variants where id in ($1, $2) order by name`, [shop.abadaM, shop.copoU])
    if (r.rows.map((x) => x.stock).join() !== '2,10') throw new Error(JSON.stringify(r.rows))
  })
})

console.log('\nLoja (outro cliente / banido / visitante):')
await asUser(ids.banido, async () => {
  await expectFail('banido não faz pedido', () =>
    q(`select public.create_order($1, '11988887777')`, [JSON.stringify([{ product_id: shop.copo, variant_id: shop.copoU, quantity: 1 }])]),
  )
  await expectFail('não vê pedido de outra pessoa', async () => {
    const r = await q(`select id, number, total from public.orders`)
    if (r.rows.length === 0) throw new Error('nenhuma linha visível')
    return r
  })
})
await asUser(null, async () => {
  await expectOk('visitante vê catálogo (sem inativos)', async () => {
    const r = (await q(`select public.shop_catalog() as c`)).rows[0].c
    if (r.some((p) => p.slug === 'rascunho-loja')) throw new Error('inativo vazou')
  })
  await expectFail('visitante não faz pedido', () =>
    q(`select public.create_order($1, '11988887777')`, [JSON.stringify([{ product_id: shop.copo, variant_id: shop.copoU, quantity: 1 }])]),
  )
  await expectFail('visitante não lê pedidos', () => q(`select id from public.orders`))
})

console.log('\nLoja (atendimento):')
await asUser(ids.atend, async () => {
  await expectOk('vê todos os pedidos', async () => {
    const r = await q(`select count(*)::int as n from public.orders`)
    if (r.rows[0].n !== 2) throw new Error(`viu ${r.rows[0].n}`)
  })
  await expectOk('recebeu aviso de pedido novo', async () => {
    const r = await q(`select count(*)::int as n from public.notifications where type = 'order_created'`)
    if (r.rows[0].n !== 2) throw new Error(`recebeu ${r.rows[0].n}`)
  })
  await expectFail('pago exige forma de pagamento', () => q(`select public.admin_set_order_status($1, 'paid')`, [shop.order1]))
  await expectOk('marca como pago (Pix) e pronto', async () => {
    await q(`select public.admin_set_order_status($1, 'paid', 'Pix recebido', 'pix')`, [shop.order1])
    await q(`select public.admin_set_order_status($1, 'ready')`, [shop.order1])
  })
  await expectFail('pedido cancelado não reabre', () => q(`select public.admin_set_order_status($1, 'paid', null, 'pix')`, [shop.order2]))
  await expectFail('não pula de pronto para aguardando', () => q(`select public.admin_set_order_status($1, 'pending')`, [shop.order1]))
  await expectFail('não edita produto', () => q(`update public.products set name = 'Hack' where id = $1`, [shop.abada]))
  await expectOk('resumo por status', () => q(`select * from public.admin_orders_summary(null, null)`))
})
await asUser(ids.cliente, async () => {
  await expectOk('cliente recebeu aviso de status e vê o histórico', async () => {
    const n = await q(`select meta->>'status' as s from public.notifications where type = 'order_status' order by created_at`)
    const h = await q(`select to_status from public.order_status_history where order_id = $1 order by created_at`, [shop.order1])
    if (n.rows.map((x) => x.s).join() !== 'paid,ready') throw new Error(JSON.stringify(n.rows))
    if (h.rows.map((x) => x.to_status).join() !== 'pending,paid,ready') throw new Error(JSON.stringify(h.rows))
  })
  await expectFail('não cancela pedido já pago', () => q(`select public.cancel_my_order($1)`, [shop.order1]))
})
await asUser(ids.admin, async () => {
  await expectFail('não exclui produto com pedidos', () => q(`delete from public.products where id = $1`, [shop.abada]))
  await expectFail('não exclui variação com pedidos', () => q(`delete from public.product_variants where id = $1`, [shop.abadaP]))
  await expectFail('não exclui produto que está em kit', () => q(`delete from public.products where id = $1`, [shop.copo]))
  await expectOk('reembolso antes da retirada devolve estoque e lote', async () => {
    await q(`select public.admin_set_order_status($1, 'refunded', 'Desistiu')`, [shop.order1])
    const v = await q(`select stock from public.product_variants where id = $1`, [shop.abadaP])
    const l = await q(`select sold_count from public.product_lots where id = $1`, [shop.lot1])
    if (v.rows[0].stock !== 3 || l.rows[0].sold_count !== 0) throw new Error(`estoque ${v.rows[0].stock}, lote ${l.rows[0].sold_count}`)
  })
  await expectOk('movimentações registradas', async () => {
    const r = await q(`select reason, count(*)::int from public.stock_movements group by reason order by reason`)
    if (!r.rows.find((x) => x.reason === 'order_return')) throw new Error(JSON.stringify(r.rows))
  })
})

// =====================================================================
// Fase 7: retirada com QR, estoque e venda rápida
// =====================================================================
console.log('\nFase 7 (estoque):')
{
  const r = await q(`insert into auth.users (email, raw_user_meta_data) values ('barraca@x.com', $1) returning id`, [
    { full_name: 'Barraca', username: 'barraca', terms_version: '2026-11-13' },
  ])
  ids.barraca = r.rows[0].id
}
await asUser(ids.admin, async () => {
  await expectOk('perfil Barraca (sales.create + orders.checkin)', async () => {
    await q(`insert into public.roles (name) values ('Barraca')`)
    await q(`insert into public.role_permissions select r.id, p.id from public.roles r, public.permissions p where r.name='Barraca' and p.key in ('sales.create','orders.checkin')`)
    await q(`update public.profiles set is_staff = true, role_id = (select id from public.roles where name='Barraca') where id = $1`, [ids.barraca])
  })
  await expectOk('compra de fornecedor soma estoque e calcula custo médio', async () => {
    const before = (await q(`select stock from public.product_variants where id = $1`, [shop.abadaP])).rows[0].stock
    shop.purchase = (
      await q(`select public.create_purchase('Confecção X', $1, null, 'pending', null, 'nota 12') as id`, [
        JSON.stringify([{ variant_id: shop.abadaP, quantity: 10, unit_cost: 20 }]),
      ])
    ).rows[0].id
    await q(`select public.create_purchase('confecção x', $1)`, [JSON.stringify([{ variant_id: shop.abadaP, quantity: 10, unit_cost: 30 }])])
    const v = await q(`select stock from public.product_variants where id = $1`, [shop.abadaP])
    const c = await q(`select avg_cost from public.variant_costs where variant_id = $1`, [shop.abadaP])
    const s = await q(`select count(*)::int as n from public.suppliers`)
    if (v.rows[0].stock !== before + 20) throw new Error(`estoque ${v.rows[0].stock}`)
    if (s.rows[0].n !== 1) throw new Error('fornecedor duplicado')
    if (Number(c.rows[0].avg_cost) <= 20 || Number(c.rows[0].avg_cost) >= 30) throw new Error(`custo ${c.rows[0].avg_cost}`)
  })
  await expectFail('ajuste sem motivo', () => q(`select public.adjust_stock($1, -1, '')`, [shop.abadaP]))
  await expectFail('ajuste que deixaria negativo', () => q(`select public.adjust_stock($1, -9999, 'perda')`, [shop.abadaP]))
  await expectOk('ajuste com motivo', () => q(`select public.adjust_stock($1, -1, 'Peça com defeito')`, [shop.abadaP]))
  await expectOk('alerta de estoque baixo', () => q(`select public.set_stock_alert($1, 5)`, [shop.abadaP]))
  await expectOk('visão geral do estoque', async () => {
    const r = await q(`select * from public.stock_overview()`)
    if (!r.rows.find((x) => x.variant_id === shop.abadaP && x.low_stock_alert === 5)) throw new Error('sem a variação')
  })
  await expectOk('marca compra como paga', () => q(`select public.set_purchase_payment($1, 'paid')`, [shop.purchase]))
  await expectFail('não insere compra direto', () => q(`insert into public.purchases (supplier_name) values ('x')`))
})

console.log('\nFase 7 (venda rápida e retirada):')
await asUser(ids.barraca, async () => {
  await expectOk('venda rápida entregue na hora (pago + retirado, baixa estoque)', async () => {
    const before = (await q(`select stock from public.product_variants where id = $1`, [shop.copoU])).rows[0].stock
    const r = (await q(`select public.quick_sale($1, 'dinheiro', 'Fulano da barraca') as o`, [
      JSON.stringify([{ product_id: shop.copo, variant_id: shop.copoU, quantity: 2 }]),
    ])).rows[0].o
    shop.sale = r.number
    const after = (await q(`select stock from public.product_variants where id = $1`, [shop.copoU])).rows[0].stock
    const o = (await q(`select public.checkin_lookup(null, $1) as o`, [r.number])).rows[0].o
    if (after !== before - 2 || o.status !== 'picked_up' || Number(r.total) !== 30) throw new Error(JSON.stringify({ before, after, s: o.status, t: r.total }))
  })
  await expectFail('venda rápida sem forma de pagamento', () =>
    q(`select public.quick_sale($1, null)`, [JSON.stringify([{ product_id: shop.copo, variant_id: shop.copoU, quantity: 1 }])]),
  )
  await expectFail('não vê custos', async () => {
    const r = await q(`select * from public.variant_costs`)
    if (r.rows.length === 0) throw new Error('nenhuma linha visível')
    return r
  })
  await expectFail('não ajusta estoque', () => q(`select public.adjust_stock($1, 1, 'x')`, [shop.copoU]))
  await expectFail('não lê a tabela de pedidos', async () => {
    const r = await q(`select id from public.orders`)
    if (r.rows.length === 0) throw new Error('nenhuma linha visível')
    return r
  })
})
// Pedido do cliente pago para testar o QR
await asUser(ids.cliente, async () => {
  shop.order3 = (await q(`select public.create_order($1, '11988887777') as o`, [JSON.stringify([{ product_id: shop.copo, variant_id: shop.copoU, quantity: 1 }])])).rows[0].o
  await expectOk('cliente não tem token enquanto aguarda pagamento', async () => {
    const r = await q(`select public.get_my_pickup_token($1) as t`, [shop.order3.id])
    if (r.rows[0].t) throw new Error('token vazou')
  })
})
await asUser(ids.atend, () => q(`select public.admin_set_order_status($1, 'paid', null, 'pix')`, [shop.order3.id]))
await asUser(ids.cliente, async () => {
  await expectOk('cliente lê o token do QR do pedido pago', async () => {
    shop.token = (await q(`select public.get_my_pickup_token($1) as t`, [shop.order3.id])).rows[0].t
    if (!shop.token) throw new Error('sem token')
  })
  await expectFail('cliente não faz check-in', () => q(`select public.checkin_confirm($1)`, [shop.order3.id]))
})
await asUser(ids.outro, async () => {
  await expectOk('outra pessoa não lê o token', async () => {
    const r = await q(`select public.get_my_pickup_token($1) as t`, [shop.order3.id])
    if (r.rows[0].t) throw new Error('token vazou')
  })
})
await asUser(ids.barraca, async () => {
  await expectOk('lê o QR e confirma a retirada', async () => {
    const o = (await q(`select public.checkin_lookup($1) as o`, [shop.token])).rows[0].o
    if (o.number !== shop.order3.number || o.items.length !== 1) throw new Error(JSON.stringify(o))
    await q(`select public.checkin_confirm($1)`, [o.id])
  })
  await expectFail('não retira duas vezes', () => q(`select public.checkin_confirm($1)`, [shop.order3.id]))
  await expectOk('token desconhecido não acha nada', async () => {
    const r = await q(`select public.checkin_lookup('nao-existe') as o`)
    if (r.rows[0].o) throw new Error('achou')
  })
})
await asUser(ids.admin, async () => {
  await expectFail('não exclui compra cujo estoque já saiu', async () => {
    await q(`select public.adjust_stock($1, -(select stock from public.product_variants where id = $1), 'zerar para teste')`, [shop.abadaP])
    return q(`select public.delete_purchase($1)`, [shop.purchase])
  })
})

// =====================================================================
// Fase 8: financeiro
// =====================================================================
console.log('\nFase 8 (financeiro):')
await asUser(ids.admin, async () => {
  await expectOk('lançamentos automáticos: 3 vendas, 1 estorno, 2 compras', async () => {
    const r = await q(`select source, count(*)::int as n from public.finance_entries group by source order by source`)
    const by = Object.fromEntries(r.rows.map((x) => [x.source, x.n]))
    if (by.order !== 3 || by.refund !== 1 || by.purchase !== 2) throw new Error(JSON.stringify(by))
  })
  await expectOk('compra paga na Fase 7 aparece paga no financeiro', async () => {
    const r = await q(`select status from public.finance_entries where purchase_id = $1`, [shop.purchase])
    if (r.rows[0].status !== 'paid') throw new Error(r.rows[0].status)
  })
  await expectOk('lançamento manual (despesa a pagar)', async () => {
    shop.manual = (
      await q(
        `insert into public.finance_entries (type, category_id, description, amount, status, due_date)
         values ('expense', (select id from public.finance_categories where name = 'Banda e músicos'), 'Sinal da banda', 1500, 'pending', current_date - 1) returning id`,
      )
    ).rows[0].id
  })
  await expectFail('categoria de receita em despesa', () =>
    q(`insert into public.finance_entries (type, category_id, description, amount) values ('expense', (select id from public.finance_categories where system_key = 'sales'), 'x x', 10)`),
  )
  await expectFail('não cria lançamento com origem de pedido', () =>
    q(`insert into public.finance_entries (type, category_id, description, amount, source) values ('income', (select id from public.finance_categories where system_key = 'sales'), 'fake', 10, 'order')`),
  )
  await expectFail('não edita lançamento automático direto', () => q(`update public.finance_entries set amount = 1 where source = 'order'`))
  await expectFail('não exclui categoria de sistema', () => q(`delete from public.finance_categories where system_key = 'sales'`))
  await expectFail('lançamento de pedido muda só pelo pedido', async () => {
    const id = (await q(`select id from public.finance_entries where source = 'order' limit 1`)).rows[0].id
    return q(`select public.finance_set_status($1, 'pending')`, [id])
  })
  await expectOk('marcar compra a pagar pelo financeiro muda a compra', async () => {
    const id = (await q(`select id from public.finance_entries where purchase_id = $1`, [shop.purchase])).rows[0].id
    await q(`select public.finance_set_status($1, 'pending')`, [id])
    const p = await q(`select payment_status from public.purchases where id = $1`, [shop.purchase])
    if (p.rows[0].payment_status !== 'pending') throw new Error(p.rows[0].payment_status)
  })
  await expectOk('paga o lançamento manual', () => q(`select public.finance_set_status($1, 'paid')`, [shop.manual]))
  await expectOk('resumo do período', async () => {
    const s = (await q(`select public.finance_summary(current_date - 30, current_date + 30) as s`)).rows[0].s
    if (Number(s.income_paid) <= 0 || Number(s.expense_paid) < 1500 || !s.by_category.length) throw new Error(JSON.stringify(s))
  })
  await expectOk('série por dia e por mês', async () => {
    await q(`select * from public.finance_timeseries(current_date - 6, current_date, 'day')`)
    await q(`select * from public.finance_timeseries(current_date - 60, current_date, 'month')`)
  })
  await expectOk('vendas por produto com custo e lucro', async () => {
    const r = await q(`select * from public.finance_product_sales(current_date - 30, current_date + 1)`)
    if (!r.rows.length) throw new Error('sem vendas')
  })
})
// Cancelar depois de pago remove a receita
await asUser(ids.cliente, async () => {
  shop.order4 = (await q(`select public.create_order($1, '11988887777') as o`, [JSON.stringify([{ product_id: shop.copo, variant_id: shop.copoU, quantity: 1 }])])).rows[0].o
})
await asUser(ids.atend, async () => {
  await expectOk('pago gera receita; cancelado depois some', async () => {
    await q(`select public.admin_set_order_status($1, 'paid', null, 'pix')`, [shop.order4.id])
    await q(`select public.admin_set_order_status($1, 'cancelled', 'desistiu')`, [shop.order4.id])
  })
  await expectFail('sem finance.view não lê lançamentos', async () => {
    const r = await q(`select id from public.finance_entries`)
    if (r.rows.length === 0) throw new Error('nenhuma linha visível')
    return r
  })
  await expectFail('sem finance.view não vê resumo', () => q(`select public.finance_summary(current_date, current_date)`))
})
await asUser(ids.admin, async () => {
  await expectOk('receita do pedido cancelado foi removida', async () => {
    const r = await q(`select count(*)::int as n from public.finance_entries where order_id = $1`, [shop.order4.id])
    if (r.rows[0].n !== 0) throw new Error(`${r.rows[0].n} lançamentos`)
  })
})
await asUser(ids.cliente, async () => {
  await expectFail('cliente não lê categorias', async () => {
    const r = await q(`select id from public.finance_categories`)
    if (r.rows.length === 0) throw new Error('nenhuma linha visível')
    return r
  })
})

await expectOk('backfill da 0013 com dados não duplica lançamentos', async () => {
  const before = (await q(`select count(*)::int as n from public.finance_entries`)).rows[0].n
  await db.exec(readFileSync(join(dir, '0013_finance.sql'), 'utf8'))
  const after = (await q(`select count(*)::int as n from public.finance_entries`)).rows[0].n
  if (before !== after) throw new Error(`${before} -> ${after}`)
})

console.log('\nEstado final:')
console.table((await q(`select like_count, comment_count from public.posts where id=$1`, [postId])).rows)
console.table((await q(`select type, count(*)::int from public.notifications group by type`)).rows)
console.table((await q(`select view_count, is_highlight from public.stories`)).rows)
console.table((await q(`select action, entity, metadata->>'label' as label from public.audit_logs order by created_at`)).rows)

// Exclusão de conta (cliente)
await asUser(ids.cliente, () => expectOk('cliente exclui a própria conta', () => q(`select public.delete_my_account()`)))
console.table((await q(`select like_count, comment_count from public.posts where id=$1`, [postId])).rows)

console.log(failures ? `\n${failures} FALHA(S)` : '\nTODOS OS TESTES PASSARAM')
process.exit(failures ? 1 : 0)
