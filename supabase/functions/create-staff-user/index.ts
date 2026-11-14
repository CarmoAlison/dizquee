// =====================================================================
// Edge Function: create-staff-user
// Cria (ou promove) um usuário da equipe interna usando a service role.
// Fluxo:
//   1. valida o JWT de quem chamou e a permissão staff.create (via RPC
//      has_permission executada COM o token do chamador);
//   2. só um Super Admin pode atribuir o perfil de sistema;
//   3. cria a conta JÁ CONFIRMADA, com a senha definida por quem cadastra
//      (nenhum e-mail é enviado; a pessoa entra direto com e-mail + senha).
//      Se o e-mail já tem conta, promove essa conta (a senha não muda);
//   4. registra no audit_logs.
// Observação: arquivo em TypeScript porque o runtime das Edge Functions
// (Deno) usa TS por padrão; nenhum código do front-end usa TS.
// Deploy: supabase functions deploy create-staff-user
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Não autenticado.' }, 401)

  // Cliente com o token de quem chamou (a RLS e has_permission valem)
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData?.user) return json({ error: 'Sessão inválida.' }, 401)
  const caller = userData.user

  const { data: canCreate, error: permError } = await callerClient.rpc('has_permission', {
    permission_key: 'staff.create',
  })
  if (permError) return json({ error: 'Falha ao validar permissão.' }, 500)
  if (!canCreate) return json({ error: 'Você não tem permissão para criar usuários da equipe.' }, 403)

  let payload: { email?: string; full_name?: string; role_id?: string; password?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Corpo da requisição inválido.' }, 400)
  }

  const email = String(payload.email ?? '').trim().toLowerCase()
  const fullName = String(payload.full_name ?? '').trim().slice(0, 80)
  const roleId = String(payload.role_id ?? '').trim()
  const password = String(payload.password ?? '')

  if (!EMAIL_RE.test(email)) return json({ error: 'E-mail inválido.' }, 400)
  if (fullName.length < 2) return json({ error: 'Informe o nome.' }, 400)
  if (!roleId) return json({ error: 'Escolha um perfil de acesso.' }, 400)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: role, error: roleError } = await admin
    .from('roles')
    .select('id, name, is_system')
    .eq('id', roleId)
    .maybeSingle()
  if (roleError || !role) return json({ error: 'Perfil de acesso não encontrado.' }, 400)

  if (role.is_system) {
    const { data: isSuper } = await callerClient.rpc('is_super_admin')
    if (!isSuper) return json({ error: 'Somente um Super Admin pode atribuir este perfil.' }, 403)
  }

  // Já existe conta com este e-mail? Promove para a equipe.
  const { data: existing } = await admin
    .from('profiles')
    .select('id, is_staff')
    .eq('email', email)
    .maybeSingle()

  let userId = existing?.id as string | undefined
  let created = false

  if (!userId) {
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return json({ error: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' }, 400)
    }
    // Conta já confirmada: nenhum e-mail é enviado
    const { data: createdData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createError || !createdData?.user) {
      return json({ error: `Não foi possível criar a conta: ${createError?.message ?? 'erro desconhecido'}` }, 400)
    }
    userId = createdData.user.id
    created = true
  }

  if (userId === caller.id) return json({ error: 'Você não pode alterar o próprio perfil de acesso.' }, 400)

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      is_staff: true,
      is_active: true,
      role_id: role.id,
      ...(created ? { full_name: fullName } : {}),
    })
    .eq('id', userId)
  if (updateError) return json({ error: 'Usuário criado, mas falhou ao definir o perfil de acesso.' }, 500)

  await admin.from('audit_logs').insert({
    actor_id: caller.id,
    action: 'staff.create',
    entity: 'user',
    entity_id: userId,
    metadata: { label: fullName || email, email, role: role.name, created },
  })

  return json({ ok: true, user_id: userId, created })
})
