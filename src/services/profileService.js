// Perfil do usuário logado, avatar, permissões e exclusão de conta
import { blobToDataUrl, dataUrlToBlob } from '../utils/imageCompression'
import { BUCKETS, getPublicUrl, listFolder, removeFiles } from './storageService'
import { supabase } from './supabaseClient'

const PROFILE_FIELDS =
  'id, full_name, username, email, phone, avatar_url, role_id, is_staff, is_active, is_banned, banned_at, banned_reason, terms_accepted_at, terms_version, created_at'

export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function getMyPermissions() {
  const { data, error } = await supabase.rpc('my_permissions')
  if (error) throw error
  return data || []
}

export async function getMyRoleName(roleId) {
  if (!roleId) return null
  const { data } = await supabase.from('roles').select('name').eq('id', roleId).maybeSingle()
  return data?.name || null
}

export async function updateMyProfile(userId, fields) {
  const allowed = {}
  for (const key of ['full_name', 'username', 'phone', 'avatar_url', 'terms_version']) {
    if (fields[key] !== undefined) allowed[key] = fields[key]
  }
  const { data, error } = await supabase.from('profiles').update(allowed).eq('id', userId).select(PROFILE_FIELDS).single()
  if (error) throw error
  return data
}

export async function isUsernameAvailable(username) {
  const { data, error } = await supabase.rpc('is_username_available', { p_username: username })
  if (error) throw error
  return Boolean(data)
}

// Envia o avatar recortado (blob WebP) para avatars/{userId}/{uuid}.webp
// e remove os avatares antigos da pasta.
export async function uploadAvatar(userId, blob) {
  const path = `${userId}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from(BUCKETS.AVATARS).upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  try {
    const old = (await listFolder(BUCKETS.AVATARS, userId)).filter((p) => p !== path)
    await removeFiles(BUCKETS.AVATARS, old)
  } catch {
    /* limpeza opcional */
  }
  return getPublicUrl(BUCKETS.AVATARS, path)
}

// Exclusão da conta (LGPD): apaga os arquivos do avatar e chama a RPC
export async function deleteMyAccount(userId) {
  try {
    const files = await listFolder(BUCKETS.AVATARS, userId)
    await removeFiles(BUCKETS.AVATARS, files)
  } catch {
    /* segue com a exclusão dos dados mesmo se a limpeza falhar */
  }
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
  await supabase.auth.signOut()
}

// ---------------------------------------------------------------------
// Avatar escolhido no cadastro com confirmação de e-mail pendente:
// fica salvo localmente e é enviado no primeiro login.
// ---------------------------------------------------------------------
const PENDING_KEY = 'pending_avatar'

export async function savePendingAvatar(email, blob) {
  try {
    const dataUrl = await blobToDataUrl(blob)
    localStorage.setItem(PENDING_KEY, JSON.stringify({ email: email.toLowerCase(), dataUrl }))
  } catch {
    /* sem espaço: ignora */
  }
}

export async function flushPendingAvatar(profile) {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw || !profile?.id) return null
    const { email, dataUrl } = JSON.parse(raw)
    if (!profile.email || email !== profile.email.toLowerCase()) return null
    localStorage.removeItem(PENDING_KEY)
    if (profile.avatar_url) return null
    const blob = await dataUrlToBlob(dataUrl)
    const url = await uploadAvatar(profile.id, blob)
    return updateMyProfile(profile.id, { avatar_url: url })
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------
// Perfis públicos (nome, usuário e foto) para autores de posts/comentários
// ---------------------------------------------------------------------
export async function fetchPublicProfiles(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (!unique.length) return {}
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, full_name, username, avatar_url, is_staff')
    .in('id', unique)
  if (error) throw error
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

export async function attachProfiles(rows, key = 'user_id', as = 'author') {
  const map = await fetchPublicProfiles((rows || []).map((r) => r[key]))
  return (rows || []).map((r) => ({ ...r, [as]: map[r[key]] || null }))
}
