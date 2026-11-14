// Dados da barra de stories: grupo "Agora" (24 h) + destaques, com estado visto/não visto
import { useCallback, useEffect, useState } from 'react'
import { getActiveStories, getHighlightsWithStories, getMyViewedStoryIds } from '../services/storiesService'
import { getSeenStories, markStorySeen } from '../utils/session'
import { useAuth } from './useAuth'

export function useStories() {
  const { user } = useAuth()
  const userId = user?.id
  const [active, setActive] = useState([])
  const [highlights, setHighlights] = useState([])
  const [seen, setSeen] = useState(() => getSeenStories())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [stories, hl] = await Promise.all([getActiveStories(), getHighlightsWithStories()])
      setActive(stories)
      setHighlights(hl)
      // vistos em outros aparelhos (usuário logado)
      const ids = [...stories, ...hl.flatMap((h) => h.stories)].map((s) => s.id)
      const serverSeen = await getMyViewedStoryIds(userId, ids)
      if (serverSeen.size) setSeen((prev) => new Set([...prev, ...serverSeen]))
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const markSeen = useCallback((storyId) => {
    markStorySeen(storyId)
    setSeen((prev) => (prev.has(storyId) ? prev : new Set([...prev, storyId])))
  }, [])

  // Grupos para o visualizador
  const groups = [
    ...(active.length ? [{ id: 'active', title: 'Agora', isActive: true, stories: active }] : []),
    ...highlights.map((h) => ({ id: h.id, title: h.title, highlight: h, stories: h.stories })),
  ].map((g) => ({ ...g, allSeen: g.stories.every((s) => seen.has(s.id)) }))

  return { groups, active, highlights, seen, loading, error, reload: load, markSeen }
}
