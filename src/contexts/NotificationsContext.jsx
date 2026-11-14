// Notificações do usuário logado: lista, contador e realtime (compartilhado
// entre o sino do header e a página /notificacoes)
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  countUnread,
  getNotification,
  listNotifications,
  markAllAsRead,
  markAsRead,
  subscribeNotifications,
} from '../services/notificationsService'
import { AuthContext, NotificationsContext } from './contexts'

const PAGE = 20

export function NotificationsProvider({ children }) {
  const { user } = useContext(AuthContext)
  const userId = user?.id
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [list, count] = await Promise.all([listNotifications({ limit: PAGE }), countUnread()])
      setItems(list)
      setUnread(count)
      setHasMore(list.length === PAGE)
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setItems([])
      setUnread(0)
      return undefined
    }
    refresh()
    const unsubscribe = subscribeNotifications(userId, {
      onInsert: async (row) => {
        setUnread((n) => n + 1)
        try {
          const full = await getNotification(row.id)
          if (full) setItems((list) => [full, ...list.filter((n) => n.id !== full.id)])
        } catch {
          /* a lista atualiza no próximo refresh */
        }
      },
      onDelete: (row) => {
        const removed = row?.id && itemsRef.current.find((n) => n.id === row.id)
        if (!removed) return
        if (!removed.read_at) setUnread((n) => Math.max(0, n - 1))
        setItems((list) => list.filter((n) => n.id !== row.id))
      },
    })
    return unsubscribe
  }, [userId, refresh])

  const loadMore = useCallback(async () => {
    const last = items[items.length - 1]
    if (!last) return
    try {
      const more = await listNotifications({ limit: PAGE, before: last.created_at })
      setItems((list) => [...list, ...more])
      setHasMore(more.length === PAGE)
    } catch (e) {
      setError(e)
    }
  }, [items])

  const markRead = useCallback(async (id) => {
    const target = itemsRef.current.find((n) => n.id === id)
    if (!target || target.read_at) return
    const now = new Date().toISOString()
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read_at: now } : n)))
    setUnread((n) => Math.max(0, n - 1))
    try {
      await markAsRead(id)
    } catch {
      /* não crítico */
    }
  }, [])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    setUnread(0)
    await markAllAsRead()
  }, [])

  const value = useMemo(
    () => ({ items, unread, loading, error, hasMore, refresh, loadMore, markRead, markAllRead }),
    [items, unread, loading, error, hasMore, refresh, loadMore, markRead, markAllRead],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
