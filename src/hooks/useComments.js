// Comentários com respostas (1 nível) para posts ('post') e stories ('story')
import { useCallback, useEffect, useMemo, useState } from 'react'
import { addComment, buildThreads, deleteComment, listComments } from '../services/commentsService'
import { useAuth } from './useAuth'

export function useComments(kind, targetId) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!targetId) return
    setLoading(true)
    setError(null)
    try {
      setComments(await listComments(kind, targetId))
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [kind, targetId])

  useEffect(() => {
    load()
  }, [load])

  const add = useCallback(
    async (content, parentId = null) => {
      const created = await addComment(kind, { targetId, userId: user.id, content, parentId })
      setComments((list) => [...list, created])
      return created
    },
    [kind, targetId, user],
  )

  const remove = useCallback(
    async (id) => {
      await deleteComment(kind, id)
      // respostas saem junto (cascade no banco)
      setComments((list) => list.filter((c) => c.id !== id && c.parent_id !== id))
    },
    [kind],
  )

  const threads = useMemo(() => buildThreads(comments), [comments])

  return { comments, threads, loading, error, reload: load, add, remove, total: comments.length }
}
