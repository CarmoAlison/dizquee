// Catálogo no painel (products.manage): produtos, fotos, variações, lotes e kits
import { MEDIA_LIMITS } from '../constants/mediaLimits'
import { compressImage } from '../utils/imageCompression'
import { BUCKETS, removeFiles, uploadWithProgress } from './storageService'
import { supabase } from './supabaseClient'

const PRODUCT_FIELDS = 'id, name, slug, description, kind, is_active, ask_holder_name, position, created_at, updated_at'
const VARIANT_FIELDS = 'id, product_id, name, stock, is_active, position, created_at'
const LOT_FIELDS = 'id, product_id, name, price, starts_at, ends_at, quantity_limit, sold_count, position, created_at'
const IMAGE_FIELDS = 'id, product_id, storage_path, position, created_at'

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at).localeCompare(String(b.created_at))

function normalizeProduct(p) {
  return {
    ...p,
    product_images: [...(p.product_images || [])].sort(byPosition),
    product_variants: [...(p.product_variants || [])].sort(byPosition),
    product_lots: [...(p.product_lots || [])].sort(byPosition),
    kit_items: [...(p.kit_items || [])].sort(byPosition),
  }
}

export async function listProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(
      `${PRODUCT_FIELDS}, product_images(${IMAGE_FIELDS}), product_variants(${VARIANT_FIELDS}), product_lots(${LOT_FIELDS}), kit_items!kit_items_kit_id_fkey(product_id, quantity, position)`,
    )
    .order('position')
    .order('created_at')
  if (error) throw error
  return (data || []).map(normalizeProduct)
}

export async function getProduct(id) {
  const { data, error } = await supabase
    .from('products')
    .select(
      `${PRODUCT_FIELDS}, product_images(${IMAGE_FIELDS}), product_variants(${VARIANT_FIELDS}), product_lots(${LOT_FIELDS}), kit_items!kit_items_kit_id_fkey(product_id, quantity, position, component:products!kit_items_product_id_fkey(id, name, is_active))`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeProduct(data) : null
}

// Produtos simples (para montar kits)
export async function listSimpleProducts() {
  const { data, error } = await supabase.from('products').select('id, name, is_active').eq('kind', 'simple').order('name')
  if (error) throw error
  return data || []
}

function cleanProduct(values) {
  return {
    name: values.name?.trim(),
    slug: values.slug?.trim(),
    description: values.description?.trim() || null,
    is_active: Boolean(values.is_active),
    ask_holder_name: Boolean(values.ask_holder_name),
  }
}

export async function createProduct(values) {
  const { data: last } = await supabase
    .from('products')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data, error } = await supabase
    .from('products')
    .insert({ ...cleanProduct(values), kind: values.kind === 'kit' ? 'kit' : 'simple', position: (last?.position ?? -1) + 1 })
    .select(PRODUCT_FIELDS)
    .single()
  if (error) throw error
  // Produto simples nasce com a variação "Único" (dá para renomear ou adicionar outras)
  if (data.kind === 'simple') {
    await supabase.from('product_variants').insert({ product_id: data.id, name: 'Único', stock: 0 })
  }
  return data
}

export async function updateProduct(id, values) {
  const { data, error } = await supabase.from('products').update(cleanProduct(values)).eq('id', id).select(PRODUCT_FIELDS).single()
  if (error) throw error
  return data
}

export async function setProductActive(id, isActive) {
  const { error } = await supabase.from('products').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function deleteProduct(product) {
  const { error } = await supabase.from('products').delete().eq('id', product.id)
  if (error) throw error
  await removeFiles(BUCKETS.PRODUCT_IMAGES, (product.product_images || []).map((i) => i.storage_path)).catch(() => {})
}

export async function reorderProducts(list) {
  const results = await Promise.all(list.map((p, index) => supabase.from('products').update({ position: index }).eq('id', p.id)))
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}

// ----- Fotos -----
export function uploadProductImage(productId, file, position, onProgress) {
  let abortUpload = () => {}
  const promise = (async () => {
    const compressed = await compressImage(file, { fileType: 'image/webp', maxDimension: 1400, quality: MEDIA_LIMITS.image.quality })
    const path = `products/${productId}/${crypto.randomUUID()}.webp`
    const upload = uploadWithProgress(BUCKETS.PRODUCT_IMAGES, path, compressed, onProgress)
    abortUpload = upload.abort
    await upload.promise
    const { data, error } = await supabase
      .from('product_images')
      .insert({ product_id: productId, storage_path: path, position })
      .select(IMAGE_FIELDS)
      .single()
    if (error) {
      await removeFiles(BUCKETS.PRODUCT_IMAGES, [path]).catch(() => {})
      throw error
    }
    return data
  })()
  return { promise, abort: () => abortUpload() }
}

export async function deleteProductImage(image) {
  const { error } = await supabase.from('product_images').delete().eq('id', image.id)
  if (error) throw error
  await removeFiles(BUCKETS.PRODUCT_IMAGES, [image.storage_path]).catch(() => {})
}

export async function reorderImages(list) {
  const results = await Promise.all(list.map((img, index) => supabase.from('product_images').update({ position: index }).eq('id', img.id)))
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}

// ----- Variações -----
export async function createVariant(productId, values, position) {
  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: productId,
      name: values.name.trim(),
      stock: Math.max(0, Math.floor(Number(values.stock) || 0)),
      is_active: values.is_active !== false,
      position,
    })
    .select(VARIANT_FIELDS)
    .single()
  if (error) throw error
  return data
}

export async function updateVariant(id, values) {
  const patch = {}
  if (values.name !== undefined) patch.name = values.name.trim()
  if (values.stock !== undefined) patch.stock = Math.max(0, Math.floor(Number(values.stock) || 0))
  if (values.is_active !== undefined) patch.is_active = Boolean(values.is_active)
  if (values.position !== undefined) patch.position = values.position
  const { data, error } = await supabase.from('product_variants').update(patch).eq('id', id).select(VARIANT_FIELDS).single()
  if (error) throw error
  return data
}

export async function deleteVariant(id) {
  const { error } = await supabase.from('product_variants').delete().eq('id', id)
  if (error) throw error
}

// ----- Lotes -----
function cleanLot(values) {
  return {
    name: values.name.trim(),
    price: values.price,
    starts_at: values.starts_at || null,
    ends_at: values.ends_at || null,
    quantity_limit: values.quantity_limit ? Number(values.quantity_limit) : null,
  }
}

export async function createLot(productId, values, position) {
  const { data, error } = await supabase
    .from('product_lots')
    .insert({ product_id: productId, ...cleanLot(values), position })
    .select(LOT_FIELDS)
    .single()
  if (error) throw error
  return data
}

export async function updateLot(id, values) {
  const { data, error } = await supabase.from('product_lots').update(cleanLot(values)).eq('id', id).select(LOT_FIELDS).single()
  if (error) throw error
  return data
}

export async function reorderLots(list) {
  const results = await Promise.all(list.map((l, index) => supabase.from('product_lots').update({ position: index }).eq('id', l.id)))
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}

export async function deleteLot(id) {
  const { error } = await supabase.from('product_lots').delete().eq('id', id)
  if (error) throw error
}

// ----- Itens do kit -----
export async function addKitItem(kitId, productId, quantity, position) {
  const { error } = await supabase.from('kit_items').insert({ kit_id: kitId, product_id: productId, quantity, position })
  if (error) throw error
}

export async function updateKitItem(kitId, productId, quantity) {
  const { error } = await supabase.from('kit_items').update({ quantity }).eq('kit_id', kitId).eq('product_id', productId)
  if (error) throw error
}

export async function removeKitItem(kitId, productId) {
  const { error } = await supabase.from('kit_items').delete().eq('kit_id', kitId).eq('product_id', productId)
  if (error) throw error
}

// Lote vigente (mesma regra de public.product_current_lot)
export function currentLot(lots, now = new Date()) {
  return (
    [...(lots || [])]
      .sort(byPosition)
      .find(
        (l) =>
          (!l.starts_at || new Date(l.starts_at) <= now) &&
          (!l.ends_at || new Date(l.ends_at) > now) &&
          (!l.quantity_limit || l.sold_count < l.quantity_limit),
      ) || null
  )
}
