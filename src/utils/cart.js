// Regras do carrinho compartilhadas entre o contexto e as páginas
export const MAX_ITEM_QUANTITY = 20

// Mesmo produto + mesmas escolhas = mesma linha do carrinho
export function cartKey(productId, variantId, parts = []) {
  const partKey = parts.map((p) => p.product_id + ':' + p.variant_id).sort().join('|')
  return [productId, variantId || '', partKey].join('#')
}
