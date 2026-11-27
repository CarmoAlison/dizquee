// Financeiro: tipos, situações, origens e formas de pagamento
export const ENTRY_TYPES = {
  income: { label: 'Receita', plural: 'Receitas' },
  expense: { label: 'Despesa', plural: 'Despesas' },
}

// O rótulo da situação depende do tipo (a receber / a pagar)
export function statusLabel(type, status) {
  if (status === 'paid') return type === 'income' ? 'Recebido' : 'Pago'
  return type === 'income' ? 'A receber' : 'A pagar'
}

export const ENTRY_SOURCES = {
  manual: 'Manual',
  order: 'Venda (pedido)',
  refund: 'Reembolso de pedido',
  purchase: 'Compra de fornecedor',
}

export const FINANCE_PAYMENT_METHODS = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  boleto: 'Boleto',
  outro: 'Outro',
}
