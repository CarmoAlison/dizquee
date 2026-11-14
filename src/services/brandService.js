// Identidade visual (tabela app_settings, linha única) e logo no bucket "brand"
import { BUCKETS, getPublicUrl, removeFiles } from './storageService'
import { supabase } from './supabaseClient'

const FIELDS = 'brand_name, short_name, tagline, logo_path, color_primary_1, color_primary_2, color_accent_1, color_accent_2, updated_at'

export async function getBrandSettings() {
  const { data, error } = await supabase.from('app_settings').select(FIELDS).eq('id', 1).maybeSingle()
  if (error) throw error
  return data
}

export async function updateBrandSettings(values) {
  const { data, error } = await supabase.from('app_settings').update(values).eq('id', 1).select(FIELDS).single()
  if (error) throw error
  return data
}

export async function uploadBrandLogo(file) {
  const ext = file.type === 'image/svg+xml' ? 'svg' : file.type === 'image/png' ? 'png' : 'webp'
  const path = `logo/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKETS.BRAND).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
  })
  if (error) throw error
  return path
}

export async function removeBrandLogo(path) {
  if (path) await removeFiles(BUCKETS.BRAND, [path])
}

export function brandLogoUrl(path) {
  return path ? getPublicUrl(BUCKETS.BRAND, path) : ''
}
