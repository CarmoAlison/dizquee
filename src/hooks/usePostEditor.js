// Orquestra o salvamento de um post no admin:
// 1) cria/atualiza o post (sempre rascunho na criação)
// 2) sincroniza categorias
// 3) remove mídias excluídas
// 4) envia mídias novas com progresso, na ordem definida
// 5) salva a nova ordem das mídias existentes
// 6) publica/despublica se o status mudou
// Se um envio falhar, o post fica salvo e dá para tentar de novo.
import { useCallback, useRef, useState } from 'react'
import {
  createPost,
  deletePostMedia,
  insertPostMedia,
  buildMediaPath,
  setPostCategories,
  setPostStatus,
  updateMediaPositions,
  updatePost,
} from '../services/postsService'
import { BUCKETS, uploadWithProgress } from '../services/storageService'
import { fileExtension } from '../utils/mediaUtils'
import { useAuth } from './useAuth'

export function usePostEditor(initialPost) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  // guarda o estado salvo no servidor (muda após o primeiro salvamento)
  const savedRef = useRef({
    id: initialPost?.id || null,
    status: initialPost?.status || 'draft',
    categoryIds: initialPost?.categoryIds || [],
  })

  const save = useCallback(
    async ({ values, items, setItems, removed, clearRemoved }) => {
      setSaving(true)
      const saved = savedRef.current
      try {
        const fields = {
          title: values.title,
          slug: values.slug,
          content: values.content,
          publishedAt: values.publishedAt,
        }

        if (!saved.id) {
          const created = await createPost({ ...fields, authorId: user.id })
          saved.id = created.id
        } else {
          await updatePost(saved.id, fields)
        }
        const postId = saved.id

        await setPostCategories(postId, values.categoryIds, saved.categoryIds)
        saved.categoryIds = [...values.categoryIds]

        if (removed.length) {
          await deletePostMedia(removed)
          clearRemoved()
        }

        // Envio das mídias novas (na ordem)
        const valid = items.filter((it) => it.status !== 'error')
        for (let index = 0; index < valid.length; index++) {
          const item = valid[index]
          if (item.kind !== 'new' || item.status === 'done') continue
          if (item.status === 'processing') throw new Error('Aguarde o processamento das mídias terminar.')
          const path = buildMediaPath(postId, fileExtension(item.file.type))
          setItems((list) => list.map((it) => (it.key === item.key ? { ...it, status: 'uploading', progress: 0 } : it)))
          try {
            await uploadWithProgress(BUCKETS.POST_MEDIA, path, item.file, (progress) =>
              setItems((list) => list.map((it) => (it.key === item.key ? { ...it, progress } : it))),
            ).promise
            const row = await insertPostMedia(postId, {
              type: item.type,
              storage_path: path,
              position: index,
              width: item.width,
              height: item.height,
              duration: item.duration,
            })
            setItems((list) =>
              list.map((it) =>
                it.key === item.key
                  ? { ...it, kind: 'existing', id: row.id, storage_path: path, position: index, status: 'done', progress: 100 }
                  : it,
              ),
            )
          } catch (e) {
            setItems((list) => list.map((it) => (it.key === item.key ? { ...it, status: 'error', error: e.message } : it)))
            throw new Error(`Falha ao enviar a mídia ${index + 1}: ${e.message} O post foi salvo como está; tente salvar de novo.`)
          }
        }

        // Nova ordem das mídias que já existiam
        const reordered = valid
          .map((it, index) => ({ ...it, newPosition: index }))
          .filter((it) => it.kind === 'existing' && it.id && it.position !== it.newPosition)
        if (reordered.length) {
          await updateMediaPositions(reordered.map((it) => ({ id: it.id, position: it.newPosition })))
          setItems((list) => list.map((it, index) => ({ ...it, position: index })))
        }

        if (values.status !== saved.status) {
          await setPostStatus(postId, values.status)
          saved.status = values.status
        }

        return postId
      } finally {
        setSaving(false)
      }
    },
    [user],
  )

  return { save, saving }
}
