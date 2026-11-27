// Venda rápida presencial (sales.create)
import { supabase } from './supabaseClient'

// Catálogo completo (inclui produtos ocultos na loja online)
export async function getStaffCatalog() {
  const { data, error } = await supabase.rpc('staff_catalog')
  if (error) throw error
  return data || []
}

/**
 * items: mesmo formato do pedido do site
 * @returns {{ id, number, total }}
 */
export async function quickSale({ items, paymentMethod, customerName, customerPhone, delivered, notes }) {
  const { data, error } = await supabase.rpc('quick_sale', {
    p_items: items,
    p_payment_method: paymentMethod,
    p_customer_name: customerName || null,
    p_customer_phone: customerPhone || null,
    p_delivered: delivered,
    p_notes: notes || null,
  })
  if (error) throw error
  return data
}
