// Financeiro: categorias, lançamentos e relatórios (finance.view / finance.manage).
// Lançamentos automáticos (pedidos, reembolsos, compras) nascem no banco.
import { supabase } from './supabaseClient'

const CATEGORY_FIELDS = 'id, name, type, color, system_key, position'
const ENTRY_FIELDS =
  'id, type, category_id, description, amount, status, due_date, paid_at, ref_date, payment_method, notes, source, order_id, purchase_id, created_at, finance_categories(name, color), orders(number)'

// ----- Categorias -----
export async function listFinanceCategories() {
  const { data, error } = await supabase.from('finance_categories').select(CATEGORY_FIELDS).order('type').order('position').order('name')
  if (error) throw error
  return data || []
}

export async function saveFinanceCategory(id, values) {
  const row = { name: values.name.trim(), type: values.type, color: values.color || null }
  const query = id
    ? supabase.from('finance_categories').update(row).eq('id', id)
    : supabase.from('finance_categories').insert({ ...row, position: 5 })
  const { error } = await query
  if (error) throw error
}

export async function deleteFinanceCategory(id) {
  const { error } = await supabase.from('finance_categories').delete().eq('id', id)
  if (error) throw error
}

// ----- Lançamentos -----
function applyFilters(query, { type = '', status = '', categoryId = '', from = '', to = '', search = '', source = '', overdue = false }) {
  if (type) query = query.eq('type', type)
  if (status) query = query.eq('status', status)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (source) query = query.eq('source', source)
  if (overdue) {
    query = query.eq('status', 'pending').lt('due_date', new Date().toISOString().slice(0, 10))
  } else {
    if (from) query = query.gte('ref_date', from)
    if (to) query = query.lte('ref_date', to)
  }
  const term = search.trim().replace(/[%,()*]/g, ' ').trim()
  if (term) query = query.or(`description.ilike.*${term}*,notes.ilike.*${term}*`)
  return query
}

export async function listEntries({ page = 0, pageSize = 30, ...filters } = {}) {
  let query = supabase
    .from('finance_entries')
    .select(ENTRY_FIELDS, { count: 'exact' })
    .order('ref_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  query = applyFilters(query, filters)
  const { data, error, count } = await query
  if (error) throw error
  return { entries: data || [], total: count || 0 }
}

// Todos os lançamentos do período (exportação e relatório)
export async function listAllEntries(filters) {
  const all = []
  for (let page = 0; page < 20; page++) {
    const { entries } = await listEntries({ ...filters, page, pageSize: 1000 })
    all.push(...entries)
    if (entries.length < 1000) break
  }
  return all.sort((a, b) => String(a.ref_date).localeCompare(String(b.ref_date)))
}

function cleanEntry(values) {
  return {
    type: values.type,
    category_id: values.category_id,
    description: values.description.trim(),
    amount: values.amount,
    status: values.status,
    due_date: values.due_date || null,
    paid_at: values.status === 'paid' ? values.paid_at || null : null,
    payment_method: values.payment_method || null,
    notes: values.notes?.trim() || null,
  }
}

export async function createEntry(values) {
  const { error } = await supabase.from('finance_entries').insert(cleanEntry(values))
  if (error) throw error
}

export async function updateEntry(id, values) {
  const { error } = await supabase.from('finance_entries').update(cleanEntry(values)).eq('id', id)
  if (error) throw error
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('finance_entries').delete().eq('id', id)
  if (error) throw error
}

export async function setEntryStatus(id, status, date = null) {
  const { error } = await supabase.rpc('finance_set_status', { p_entry_id: id, p_status: status, p_date: date })
  if (error) throw error
}

// ----- Relatórios -----
export async function getFinanceSummary(from, to) {
  const { data, error } = await supabase.rpc('finance_summary', { p_from: from, p_to: to })
  if (error) throw error
  return data
}

export async function getFinanceTimeseries(from, to, group = 'day') {
  const { data, error } = await supabase.rpc('finance_timeseries', { p_from: from, p_to: to, p_group: group })
  if (error) throw error
  return (data || []).map((r) => ({ ...r, income: Number(r.income), expense: Number(r.expense) }))
}

export async function getProductSales(from, to) {
  const { data, error } = await supabase.rpc('finance_product_sales', { p_from: from, p_to: to })
  if (error) throw error
  return (data || []).map((r) => ({ ...r, revenue: Number(r.revenue), cost: Number(r.cost), profit: Number(r.profit) }))
}
