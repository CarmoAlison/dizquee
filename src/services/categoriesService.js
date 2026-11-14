import { supabase } from './supabaseClient'

const FIELDS = 'id, name, slug, description, color, position'

export async function listCategories() {
  const { data, error } = await supabase.from('categories').select(FIELDS).order('position').order('name')
  if (error) throw error
  return data || []
}

export async function createCategory(values) {
  const { data: last } = await supabase
    .from('categories')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data, error } = await supabase
    .from('categories')
    .insert({ ...clean(values), position: (last?.position ?? -1) + 1 })
    .select(FIELDS)
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id, values) {
  const { data, error } = await supabase.from('categories').update(clean(values)).eq('id', id).select(FIELDS).single()
  if (error) throw error
  return data
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

// Salva a nova ordem (lista já ordenada)
export async function reorderCategories(list) {
  const results = await Promise.all(
    list.map((c, index) => supabase.from('categories').update({ position: index }).eq('id', c.id)),
  )
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}

function clean({ name, slug, description, color }) {
  return {
    name: name?.trim(),
    slug: slug?.trim(),
    description: description?.trim() || null,
    color: color || null,
  }
}
