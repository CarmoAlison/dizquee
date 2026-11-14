// Criação de story: imagem ou vídeo, legenda e validade (24 h ou destaque)
import { useEffect, useRef, useState } from 'react'
import { MEDIA_LIMITS } from '../../../constants/mediaLimits'
import { PERMISSIONS } from '../../../constants/permissions'
import { useAuth } from '../../../hooks/useAuth'
import { usePermission } from '../../../hooks/usePermission'
import { createHighlight, listHighlights } from '../../../services/highlightsService'
import { BUCKETS, uploadWithProgress } from '../../../services/storageService'
import { buildStoryPath, createStory } from '../../../services/storiesService'
import { getErrorMessage } from '../../../utils/errors'
import { compressImage } from '../../../utils/imageCompression'
import { fileExtension, formatBytes, formatDuration, getMediaKind, readImageMeta, readVideoMeta } from '../../../utils/mediaUtils'
import { Button } from '../../common/Button/Button'
import { Icon } from '../../common/Icon/Icon'
import { Input } from '../../common/Input/Input'
import { Loader } from '../../common/Loader/Loader'
import { Modal } from '../../common/Modal/Modal'
import { ProgressBar } from '../../common/ProgressBar/ProgressBar'
import { SegmentedControl } from '../../common/SegmentedControl/SegmentedControl'
import styles from './StoryUploader.module.css'

export function StoryUploader({ open, onClose, onCreated }) {
  const { user } = useAuth()
  const canHighlight = usePermission(PERMISSIONS.STORIES_MANAGE_HIGHLIGHTS)
  const inputRef = useRef(null)
  const [media, setMedia] = useState(null) // { file, type, previewUrl, width, height, duration }
  const [processing, setProcessing] = useState(false)
  const [caption, setCaption] = useState('')
  const [validity, setValidity] = useState('24h')
  const [highlights, setHighlights] = useState([])
  const [highlightId, setHighlightId] = useState('')
  const [newHighlightTitle, setNewHighlightTitle] = useState('')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !canHighlight) return
    listHighlights()
      .then(setHighlights)
      .catch(() => setHighlights([]))
  }, [open, canHighlight])

  useEffect(() => () => media?.previewUrl && URL.revokeObjectURL(media.previewUrl), [media])

  const reset = () => {
    setMedia(null)
    setCaption('')
    setValidity('24h')
    setHighlightId('')
    setNewHighlightTitle('')
    setProgress(null)
    setError('')
  }

  const close = () => {
    if (progress !== null) return
    reset()
    onClose()
  }

  const pick = async (file) => {
    setError('')
    const type = getMediaKind(file)
    if (!type) {
      setError('Formato não suportado. Use imagem (JPG, PNG, WebP) ou vídeo MP4.')
      return
    }
    setProcessing(true)
    try {
      if (type === 'image') {
        const compressed = await compressImage(file, { fileType: MEDIA_LIMITS.output.story, maxDimension: 1920 })
        const meta = await readImageMeta(compressed)
        setMedia({ file: compressed, type, previewUrl: URL.createObjectURL(compressed), ...meta })
      } else {
        if (file.size > MEDIA_LIMITS.storyVideo.maxSize) {
          throw new Error(`Vídeo acima de ${formatBytes(MEDIA_LIMITS.storyVideo.maxSize)}.`)
        }
        const meta = await readVideoMeta(file)
        if (meta.duration > MEDIA_LIMITS.storyVideo.maxDuration + 0.5) {
          throw new Error(`O vídeo do story pode ter no máximo ${MEDIA_LIMITS.storyVideo.maxDuration} segundos.`)
        }
        setMedia({ file, type, previewUrl: URL.createObjectURL(file), ...meta })
      }
    } catch (e) {
      setError(e.message || 'Não foi possível ler o arquivo.')
    } finally {
      setProcessing(false)
    }
  }

  const submit = async () => {
    if (!media) {
      setError('Escolha uma imagem ou vídeo.')
      return
    }
    const isHighlight = validity === 'highlight'
    if (isHighlight && !highlightId && !newHighlightTitle.trim()) {
      setError('Escolha um destaque ou dê um nome para um novo destaque.')
      return
    }
    setError('')
    setProgress(0)
    try {
      let targetHighlight = highlightId
      if (isHighlight && !targetHighlight) {
        const created = await createHighlight({ title: newHighlightTitle })
        targetHighlight = created.id
      }
      const path = buildStoryPath(fileExtension(media.file.type))
      await uploadWithProgress(BUCKETS.STORY_MEDIA, path, media.file, setProgress).promise
      const story = await createStory({
        authorId: user.id,
        mediaType: media.type,
        storagePath: path,
        caption,
        isHighlight,
        highlightId: targetHighlight,
        width: media.width,
        height: media.height,
        duration: media.duration ? Math.round(media.duration * 100) / 100 : null,
      })
      reset()
      onCreated?.(story)
    } catch (e) {
      setError(getErrorMessage(e, e.message || 'Falha ao publicar o story.'))
      setProgress(null)
    }
  }

  const uploading = progress !== null

  return (
    <Modal
      open={open}
      onClose={close}
      title="Novo story"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={uploading} disabled={!media || processing}>
            Publicar story
          </Button>
        </>
      }
    >
      <div className={styles.layout}>
        <div className={styles.preview}>
          {processing && (
            <div className={styles.placeholder}>
              <Loader size="sm" inline /> Processando…
            </div>
          )}
          {!processing && media?.type === 'image' && <img src={media.previewUrl} alt="Prévia do story" />}
          {!processing && media?.type === 'video' && <video src={media.previewUrl} controls playsInline muted />}
          {!processing && !media && (
            <button type="button" className={styles.placeholder} onClick={() => inputRef.current?.click()}>
              <Icon name="upload" size={28} />
              Escolher imagem ou vídeo
              <small>Formato vertical 9:16 fica melhor</small>
            </button>
          )}
        </div>

        <div className={styles.fields}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) pick(f)
            }}
          />
          {media && (
            <Button variant="secondary" size="sm" icon="refresh" onClick={() => inputRef.current?.click()} disabled={uploading}>
              Trocar arquivo
            </Button>
          )}
          {media?.type === 'video' && <p className={styles.small}>Duração: {formatDuration(media.duration)}</p>}
          <p className={styles.small}>
            Vídeos até {MEDIA_LIMITS.storyVideo.maxDuration}s e {formatBytes(MEDIA_LIMITS.storyVideo.maxSize)}.
          </p>

          <Input as="textarea" label="Legenda (opcional)" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} rows={3} />

          <div className={styles.field}>
            <span className={styles.label}>Validade</span>
            <SegmentedControl
              label="Validade do story"
              value={validity}
              onChange={setValidity}
              options={[
                { value: '24h', label: 'Expira em 24 h' },
                ...(canHighlight ? [{ value: 'highlight', label: 'Destaque' }] : []),
              ]}
            />
          </div>

          {validity === 'highlight' && (
            <>
              <Input as="select" label="Coleção de destaque" value={highlightId} onChange={(e) => setHighlightId(e.target.value)}>
                <option value="">+ Criar novo destaque</option>
                {highlights.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                  </option>
                ))}
              </Input>
              {!highlightId && (
                <Input label="Nome do novo destaque" value={newHighlightTitle} onChange={(e) => setNewHighlightTitle(e.target.value)} maxLength={40} />
              )}
            </>
          )}

          {uploading && <ProgressBar value={progress} label="Envio do story" />}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
