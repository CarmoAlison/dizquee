// =====================================================================
// Edge Function: cleanup-stories
// Remove arquivos e registros de stories expirados (não destacados) há
// mais de STORY_RETENTION_DAYS dias (padrão 30, para manter estatísticas
// por um tempo). Chamada diariamente pelo pg_cron (ver 0008_stories.sql).
// Protegida pelo header x-cron-secret (secret CRON_SECRET).
// Deploy: supabase functions deploy cleanup-stories --no-verify-jwt
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401 })
  }

  const retention = Number(Deno.env.get('STORY_RETENTION_DAYS') ?? '30')
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data: stories, error } = await admin.rpc('expired_stories_for_cleanup', {
    p_retention_days: Number.isFinite(retention) ? retention : 30,
  })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  if (!stories?.length) return new Response(JSON.stringify({ removed: 0 }))

  const paths = stories.map((s: { storage_path: string }) => s.storage_path)
  const { error: storageError } = await admin.storage.from('story-media').remove(paths)
  if (storageError) return new Response(JSON.stringify({ error: storageError.message }), { status: 500 })

  const ids = stories.map((s: { id: string }) => s.id)
  const { error: deleteError } = await admin.from('stories').delete().in('id', ids)
  if (deleteError) return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })

  return new Response(JSON.stringify({ removed: ids.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
