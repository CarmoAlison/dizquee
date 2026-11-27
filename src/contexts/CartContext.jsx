// Carrinho da loja guardado no aparelho (localStorage). Os preços aqui são
// só para exibição: o banco recalcula tudo ao criar o pedido.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MAX_ITEM_QUANTITY } from '../utils/cart'
import { CartContext } from './contexts'

const STORAGE_KEY = 'dqe-cart-v1'

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((i) => i?.key && i.product_id && i.quantity > 0) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* armazenamento cheio ou bloqueado */
    }
  }, [items])

  // Sincroniza entre abas
  useEffect(() => {
    const onStorage = (e) => e.key === STORAGE_KEY && setItems(load())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((item) => {
    setItems((list) => {
      const existing = list.find((i) => i.key === item.key)
      if (!existing) return [...list, { ...item, quantity: Math.min(item.quantity, MAX_ITEM_QUANTITY) }]
      return list.map((i) =>
        i.key === item.key
          ? {
              ...i,
              ...item,
              quantity: Math.min(i.quantity + item.quantity, MAX_ITEM_QUANTITY),
              holder_names: [...(i.holder_names || []), ...(item.holder_names || [])].slice(0, MAX_ITEM_QUANTITY),
            }
          : i,
      )
    })
  }, [])

  const setQuantity = useCallback((key, quantity) => {
    const q = Math.max(1, Math.min(MAX_ITEM_QUANTITY, Math.floor(quantity) || 1))
    setItems((list) => list.map((i) => (i.key === key ? { ...i, quantity: q, holder_names: (i.holder_names || []).slice(0, q) } : i)))
  }, [])

  const setHolderNames = useCallback((key, names) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, holder_names: names.slice(0, i.quantity) } : i)))
  }, [])

  const remove = useCallback((key) => setItems((list) => list.filter((i) => i.key !== key)), [])
  const clear = useCallback(() => setItems([]), [])

  const value = useMemo(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0)
    return { items, count, add, setQuantity, setHolderNames, remove, clear }
  }, [items, add, setQuantity, setHolderNames, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
