// Destaques: coleções permanentes de stories (título + capa), com ordem
import { useRef, useState } from 'react'
import { MEDIA_LIMITS } from '../../../constants/mediaLimits'
import { useAsync } from '../../../hooks/useAsync'
import { useToast } from '../../../hooks/useToast'
import {
  createHighlight,
  deleteHighlight,
  highlightCoverUrl,
  listHighlights,
  reorderHighlights,
  updateHighlight,
  uploadHighlightCover,
} from '../../../services/highlightsService'
import { BUCKETS, removeFiles } from '../../../services/storageService'
import { getErrorMessage } from '../../../utils/errors'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { AvatarCropper } from '../../../components/auth/AvatarPicker/AvatarCropper'
import { Avatar } from '../../../components/common/Avatar/Avatar'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'

export default function Highlights() {
  const toast = useToast()
  const { data, setData, loading, error, reload } = useAsync(listHighlights, [])
  const [editing, setEditing] = useState(null) // 'new' | highlight
  const [toDelete, setToDelete] = useState(null)
  const highlights = data || []

  const move = async (index, dir) => {
    const list = [...highlights]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    setData(list)
    try {
      await reorderHighlights(list)
    } catch (e) {
      toast.error(getErrorMessage(e))
      reload()
    }
  }

  return (
    <>
      <PageHeader
        title="Destaques"
        description="Coleções fixas de stories, como no Instagram. Adicione stories a um destaque pela tela de Stories."
        actions={
          <Button icon="plus" onClick={() => setEditing('new')}>
            Novo destaque
          </Button>
        }
      />

      {loading && <Skeleton height={200} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && highlights.length === 0 && (
        <EmptyState icon="star" title="Nenhum destaque" description="Crie coleções como Desfile 2026, Ensaios, Bastidores…" />
      )}

      {!loading && highlights.length > 0 && (
        <ul className={shared.list}>
          {highlights.map((h, i) => (
            <li key={h.id} className={shared.row}>
              <Avatar src={highlightCoverUrl(h)} name={h.title} size={56} ring />
              <div className={shared.rowMain}>
                <span className={shared.rowTitle}>{h.title}</span>
                <span className={shared.rowMeta}>
                  {h.storyCount} {h.storyCount === 1 ? 'story' : 'stories'}
                  {h.storyCount === 0 && ' · não aparece no site até ter stories'}
                </span>
              </div>
              <div className={shared.rowActions}>
                <Button variant="ghost" size="sm" iconOnly icon="chevronUp" aria-label={`Subir ${h.title}`} onClick={() => move(i, -1)} disabled={i === 0} />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon="chevronDown"
                  aria-label={`Descer ${h.title}`}
                  onClick={() => move(i, 1)}
                  disabled={i === highlights.length - 1}
                />
                <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditing(h)}>
                  Editar
                </Button>
                <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label={`Excluir ${h.title}`} onClick={() => setToDelete(h)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <HighlightForm
          highlight={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteHighlight(toDelete)
          toast.success('Destaque excluído.')
          reload()
        }}
        title={`Excluir o destaque "${toDelete?.title}"?`}
        description="Os stories dele não são apagados: passam a contar como expirados (somem do site) e serão limpos pela rotina automática."
        confirmLabel="Excluir destaque"
      />
    </>
  )
}

function HighlightForm({ highlight, onClose, onSaved }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [title, setTitle] = useState(highlight?.title || '')
  const [coverFile, setCoverFile] = useState(null)
  const [coverBlob, setCoverBlob] = useState(null)
  const [preview, setPreview] = useState(highlight ? highlightCoverUrl(highlight) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Dê um título ao destaque.')
      return
    }
    setSaving(true)
    try {
      let coverPath
      if (coverBlob) coverPath = await uploadHighlightCover(coverBlob)
      if (highlight) {
        await updateHighlight(highlight.id, { title, ...(coverPath ? { coverPath } : {}) })
        if (coverPath && highlight.cover_path) await removeFiles(BUCKETS.HIGHLIGHT_COVERS, [highlight.cover_path]).catch(() => {})
      } else {
        await createHighlight({ title, coverPath })
      }
      toast.success('Destaque salvo!')
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={highlight ? 'Editar destaque' : 'Novo destaque'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="highlight-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="highlight-form" className={shared.stack} onSubmit={submit} noValidate>
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} error={error} required data-autofocus />
        <div className={shared.row}>
          <Avatar src={preview} name={title || 'Destaque'} size={64} ring />
          <div className={shared.rowMain}>
            <span className={shared.rowTitle}>Capa</span>
            <span className={shared.rowMeta}>Sem capa, usamos a primeira imagem do destaque.</span>
          </div>
          <Button variant="secondary" size="sm" icon="camera" onClick={() => inputRef.current?.click()}>
            Escolher
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) setCoverFile(f)
          }}
        />
      </form>
      <AvatarCropper
        file={coverFile}
        open={Boolean(coverFile)}
        title="Ajustar capa"
        outputSize={MEDIA_LIMITS.highlightCover.size}
        onCancel={() => setCoverFile(null)}
        onConfirm={(blob) => {
          setCoverFile(null)
          setCoverBlob(blob)
          setPreview(URL.createObjectURL(blob))
        }}
      />
    </Modal>
  )
}
