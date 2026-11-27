// Status dos pedidos, formas de pagamento e transições permitidas
// (as mesmas regras de public.apply_order_status no banco).
export const ORDER_STATUS = {
  pending: { label: 'Aguardando pagamento', tone: 'warning', icon: 'clock' },
  paid: { label: 'Pago', tone: 'success', icon: 'check' },
  ready: { label: 'Pronto para retirada', tone: 'accent', icon: 'bag' },
  picked_up: { label: 'Retirado', tone: 'neutral', icon: 'check' },
  cancelled: { label: 'Cancelado', tone: 'danger', icon: 'ban' },
  refunded: { label: 'Reembolsado', tone: 'danger', icon: 'refresh' },
}

export const ORDER_STATUS_ORDER = ['pending', 'paid', 'ready', 'picked_up', 'cancelled', 'refunded']

// Para onde cada status pode ir (voltar um passo serve para corrigir engano)
export const ORDER_TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['ready', 'picked_up', 'pending', 'cancelled', 'refunded'],
  ready: ['picked_up', 'paid', 'cancelled', 'refunded'],
  picked_up: ['ready', 'refunded'],
  cancelled: [],
  refunded: [],
}

// Próximos passos "normais" (botões principais); o resto vira ação secundária
export const ORDER_PRIMARY_NEXT = {
  pending: ['paid'],
  paid: ['ready', 'picked_up'],
  ready: ['picked_up'],
  picked_up: [],
  cancelled: [],
  refunded: [],
}

// Rótulo do botão de cada ação
export const ORDER_ACTION_LABEL = {
  pending: 'Voltar para aguardando pagamento',
  paid: 'Marcar como pago',
  ready: 'Pronto para retirada',
  picked_up: 'Marcar como retirado',
  cancelled: 'Cancelar pedido',
  refunded: 'Marcar como reembolsado',
}

export const PAYMENT_METHODS = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  outro: 'Outro',
}

// Status em que o pedido ainda "vale" (entra no total vendido)
export const ACTIVE_ORDER_STATUSES = ['paid', 'ready', 'picked_up']
