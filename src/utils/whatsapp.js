// Links do WhatsApp (wa.me) com mensagem pronta
import { formatMoney } from './money'

export function whatsappLink(phone, text = '') {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

// Linhas de um item do pedido: "2x Abadá 2027 (M) - R$ 100,00"
export function describeItem(item) {
  const parts = (item.order_item_parts || item.parts || [])
    .map((p) => (item.product_kind === 'kit' || item.kind === 'kit' ? `${p.product_name}: ${p.variant_name}` : p.variant_name))
    .filter((v) => v && v !== 'Único')
  const detail = parts.length ? ` (${parts.join(', ')})` : ''
  const names = item.holder_names?.length ? ` · Nomes: ${item.holder_names.join(', ')}` : ''
  return `${item.quantity}x ${item.product_name}${detail}${names}`
}

// Mensagem que o cliente manda para o bloco
export function customerOrderMessage(order, brandName = 'bloco') {
  const lines = [
    `Olá! Fiz o pedido *#${order.number}* no site do ${brandName}.`,
    '',
    ...(order.order_items || []).map((i) => `• ${describeItem(i)} - ${formatMoney(i.unit_price * i.quantity)}`),
    '',
    `*Total: ${formatMoney(order.total)}*`,
    order.customer_name ? `Nome: ${order.customer_name}` : null,
    '',
    'Como faço o pagamento?',
  ]
  return lines.filter((l) => l !== null).join('\n')
}

// Mensagem que a equipe manda para o cliente
export function staffOrderMessage(order) {
  const first = String(order.customer_name || '').split(' ')[0]
  return `Olá${first ? `, ${first}` : ''}! Aqui é do bloco, sobre o seu pedido *#${order.number}* (${formatMoney(order.total)}).`
}
