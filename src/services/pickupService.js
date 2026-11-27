// Retirada com QR Code: token do cliente, busca e confirmação pela equipe
import { ROUTES } from '../constants/routes'
import { supabase } from './supabaseClient'

// Token secreto (só o dono, só com o pedido pago ou pronto)
export async function getMyPickupToken(orderId) {
  const { data, error } = await supabase.rpc('get_my_pickup_token', { p_order_id: orderId })
  if (error) throw error
  return data || null
}

// O QR guarda um link: lido pela câmera comum do celular da equipe, já
// abre a tela de retirada com o pedido.
export function pickupQrContent(token) {
  return `${window.location.origin}${ROUTES.ADMIN_CHECKIN}?t=${encodeURIComponent(token)}`
}

// Aceita o link completo ou só o token
export function extractPickupToken(text) {
  const value = String(text || '').trim()
  try {
    const url = new URL(value)
    return url.searchParams.get('t') || ''
  } catch {
    return /^[a-f0-9]{32}$/i.test(value) ? value : ''
  }
}

export async function lookupPickup({ token, number }) {
  const { data, error } = await supabase.rpc('checkin_lookup', {
    p_token: token || null,
    p_number: number ? Number(number) : null,
  })
  if (error) throw error
  return data || null
}

export async function confirmPickup(orderId) {
  const { error } = await supabase.rpc('checkin_confirm', { p_order_id: orderId })
  if (error) throw error
}
