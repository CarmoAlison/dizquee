// Loja pública: catálogo (RPC shop_catalog, só produtos ativos), configurações
// da loja e regras de disponibilidade usadas na vitrine e no carrinho.
import { BUCKETS, getPublicUrl } from './storageService'
import { supabase } from './supabaseClient'

const SETTINGS_FIELDS = 'is_open, whatsapp_number, pickup_info, notice, updated_at'

export async function getCatalog() {
  const { data, error } = await supabase.rpc('shop_catalog')
  if (error) throw error
  return data || []
}

export async function getProductBySlug(slug) {
  const { data, error } = await supabase.rpc('shop_catalog', { p_slug: slug })
  if (error) throw error
  return data?.[0] || null
}

export async function getShopSettings() {
  const { data, error } = await supabase.from('shop_settings').select(SETTINGS_FIELDS).eq('id', 1).maybeSingle()
  if (error) throw error
  return data || { is_open: false }
}

export async function updateShopSettings(values) {
  const { data, error } = await supabase
    .from('shop_settings')
    .update({
      is_open: Boolean(values.is_open),
      whatsapp_number: values.whatsapp_number || null,
      pickup_info: values.pickup_info?.trim() || null,
      notice: values.notice?.trim() || null,
    })
    .eq('id', 1)
    .select(SETTINGS_FIELDS)
    .single()
  if (error) throw error
  return data
}

export function productImageUrl(path, opts) {
  return getPublicUrl(BUCKETS.PRODUCT_IMAGES, path, opts)
}

// Produto simples com uma única variação "Único": a escolha fica escondida
export function hasRealVariants(variants) {
  const list = variants || []
  return !(list.length === 1 && list[0].name === 'Único')
}

// Quantas unidades dá para vender agora (pelo estoque)
export function availableUnits(product) {
  if (!product) return 0
  if (product.kind === 'kit') {
    const items = product.kit_items || []
    if (!items.length) return 0
    return Math.min(
      ...items.map((k) => Math.floor(Math.max(0, ...(k.variants || []).map((v) => v.stock)) / (k.quantity || 1))),
    )
  }
  return Math.max(0, ...(product.variants || []).map((v) => v.stock))
}

// Situação de venda na vitrine: 'available' | 'soldout' | 'soon'
export function saleState(product) {
  if (!product?.lot) return product?.next_lot ? 'soon' : 'soldout'
  return availableUnits(product) > 0 ? 'available' : 'soldout'
}
