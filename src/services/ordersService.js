// Pedidos: criar (RPC), meus pedidos, cancelar e, no painel, lista,
// detalhe e mudança de status. Nada é gravado direto nas tabelas.
import { attachProfiles } from './profileService'
import { supabase } from './supabaseClient'

const ORDER_FIELDS =
  'id, number, user_id, status, channel, customer_name, customer_phone, notes, total, item_count, payment_method, created_at, updated_at, paid_at, ready_at, picked_up_at, cancelled_at, refunded_at'
const ITEM_FIELDS =
  'order_items(id, product_id, product_name, product_kind, lot_name, unit_price, quantity, holder_names, created_at, order_item_parts(id, product_name, variant_name, quantity))'
const HISTORY_FIELDS = 'order_status_history(id, from_status, to_status, note, actor_id, created_at)'

const byCreated = (a, b) => String(a.created_at).localeCompare(String(b.created_at))

/**
 * items: [{ product_id, quantity, variant_id?, parts?: [{product_id, variant_id}], holder_names?: [] }]
 * @returns {{ id, number, total }}
 */
export async function createOrder(items, phone, notes) {
  const { data, error } = await supabase.rpc('create_order', { p_items: items, p_phone: phone, p_notes: notes || null })
  if (error) throw error
  return data
}

export async function listMyOrders(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`${ORDER_FIELDS}, order_items(product_name, quantity)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data || []
}

export async function getOrderByNumber(number) {
  const n = Number(number)
  if (!Number.isInteger(n) || n <= 0) return null
  const { data, error } = await supabase
    .from('orders')
    .select(`${ORDER_FIELDS}, ${ITEM_FIELDS}, ${HISTORY_FIELDS}`)
    .eq('number', n)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const history = await attachProfiles([...(data.order_status_history || [])].sort(byCreated), 'actor_id', 'actor')
  return { ...data, order_items: [...(data.order_items || [])].sort(byCreated), order_status_history: history }
}

export async function cancelMyOrder(orderId) {
  const { error } = await supabase.rpc('cancel_my_order', { p_order_id: orderId })
  if (error) throw error
}

// ----- Painel -----

function dayStart(date) {
  return date ? new Date(`${date}T00:00:00`).toISOString() : null
}

function dayEnd(date) {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : null
}

function applyFilters(query, { search = '', status = '', from = '', to = '' }) {
  if (status) query = query.eq('status', status)
  if (from) query = query.gte('created_at', dayStart(from))
  if (to) query = query.lte('created_at', dayEnd(to))
  const term = search.trim().replace(/^#/, '').replace(/[%,()*]/g, ' ').trim()
  if (term) {
    const digits = term.replace(/\D/g, '')
    const filters = [`customer_name.ilike.*${term}*`]
    if (digits.length >= 4) filters.push(`customer_phone.ilike.*${digits}*`)
    if (/^\d{1,9}$/.test(term)) filters.push(`number.eq.${term}`)
    query = query.or(filters.join(','))
  }
  return query
}

export async function listOrders({ page = 0, pageSize = 25, ...filters } = {}) {
  let query = supabase
    .from('orders')
    .select(`${ORDER_FIELDS}, order_items(product_name, quantity)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  query = applyFilters(query, filters)
  const { data, error, count } = await query
  if (error) throw error
  return { orders: data || [], total: count || 0 }
}

export async function getOrdersSummary({ from = '', to = '' } = {}) {
  const { data, error } = await supabase.rpc('admin_orders_summary', { p_from: dayStart(from), p_to: dayEnd(to) })
  if (error) throw error
  return data || []
}

export async function setOrderStatus(orderId, status, { note = '', paymentMethod = null } = {}) {
  const { error } = await supabase.rpc('admin_set_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_note: note || null,
    p_payment_method: paymentMethod || null,
  })
  if (error) throw error
}
