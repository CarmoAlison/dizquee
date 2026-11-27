// Estoque (stock.manage): visão geral, movimentações, ajustes, alertas,
// fornecedores e compras. Tudo que muda estoque passa por funções do banco.
import { attachProfiles } from './profileService'
import { supabase } from './supabaseClient'

export const MOVEMENT_REASONS = {
  initial: 'Estoque inicial',
  purchase: 'Compra',
  order: 'Pedido do site',
  sale: 'Venda rápida',
  order_return: 'Devolvido (cancelado/reembolsado)',
  adjustment: 'Ajuste',
}

export async function getStockOverview() {
  const { data, error } = await supabase.rpc('stock_overview')
  if (error) throw error
  return data || []
}

export async function listMovements({ variantId = null, reason = '', page = 0, pageSize = 30 } = {}) {
  let query = supabase
    .from('stock_movements')
    .select(
      'id, variant_id, quantity, reason, order_id, purchase_id, note, actor_id, created_at, product_variants(name, products(name)), orders(number)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (variantId) query = query.eq('variant_id', variantId)
  if (reason) query = query.eq('reason', reason)
  const { data, error, count } = await query
  if (error) throw error
  return { movements: await attachProfiles(data || [], 'actor_id', 'actor'), total: count || 0 }
}

export async function adjustStock(variantId, delta, note) {
  const { data, error } = await supabase.rpc('adjust_stock', { p_variant_id: variantId, p_delta: delta, p_note: note })
  if (error) throw error
  return data
}

export async function setStockAlert(variantId, alert) {
  const { error } = await supabase.rpc('set_stock_alert', { p_variant_id: variantId, p_alert: alert })
  if (error) throw error
}

// ----- Fornecedores e compras -----
export async function listSuppliers() {
  const { data, error } = await supabase.from('suppliers').select('id, name, phone, notes').order('name')
  if (error) throw error
  return data || []
}

const PURCHASE_FIELDS =
  'id, supplier_id, supplier_name, purchased_at, total, payment_status, due_date, paid_at, notes, created_by, created_at, purchase_items(id, product_name, variant_name, quantity, unit_cost)'

export async function listPurchases({ status = '', page = 0, pageSize = 25 } = {}) {
  let query = supabase
    .from('purchases')
    .select(PURCHASE_FIELDS, { count: 'exact' })
    .order('purchased_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (status) query = query.eq('payment_status', status)
  const { data, error, count } = await query
  if (error) throw error
  return { purchases: data || [], total: count || 0 }
}

/**
 * items: [{ variant_id, quantity, unit_cost }]
 */
export async function createPurchase({ supplierName, items, purchasedAt, paymentStatus, dueDate, notes }) {
  const { data, error } = await supabase.rpc('create_purchase', {
    p_supplier_name: supplierName,
    p_items: items,
    p_purchased_at: purchasedAt || null,
    p_payment_status: paymentStatus,
    p_due_date: dueDate || null,
    p_notes: notes || null,
  })
  if (error) throw error
  return data
}

export async function deletePurchase(id) {
  const { error } = await supabase.rpc('delete_purchase', { p_purchase_id: id })
  if (error) throw error
}

export async function setPurchasePayment(id, status, paidAt = null) {
  const { error } = await supabase.rpc('set_purchase_payment', { p_purchase_id: id, p_status: status, p_paid_at: paidAt })
  if (error) throw error
}
