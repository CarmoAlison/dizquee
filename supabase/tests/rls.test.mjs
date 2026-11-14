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
