import { useContext } from 'react'
import { CartContext } from '../contexts/contexts'

/** Carrinho da loja: { items, count, add, setQuantity, setHolderNames, remove, clear } */
export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart precisa estar dentro do CartProvider.')
  return value
}
