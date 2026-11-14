// Gerenciador de fotos/vídeos do post: adicionar (com compressão de imagem
// e validação de vídeo), reordenar, remover e ver o progresso do envio.
import { useRef } from 'react'
import { MEDIA_LIMITS } from '../../../constants/mediaLimits'
import { cn } from '../../../utils/cn'
import { compressImage } from '../../../utils/imageCompression'
import { formatBytes, formatDuration, getMediaKind, readImageMeta, readVideoMeta } from '../../../utils/mediaUtils'
import { Button } from '../../common/Button/Button'
import { Icon } from '../../common/Icon/Icon'
import { Loader } from '../../common/Loader/Loader'
import { ProgressBar } from '../../common/ProgressBar/ProgressBar'
import styles from './MediaManager.module.css'

let keySeq = 0
const newKey = () => `m${Date.now()}-${keySeq++}`

/**
 * items/onChange: lista controlada pelo pai.
 * update(key, patch) é usado aqui para atualizar itens enquanto processam.
 */
export function MediaManager({ items, setItems, onRemove, disabled }) {
  const inputRef = useRef(null)
  const update = (key, patch) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)))

  const addFiles = async (fileList) => {
    const files = [...fileList]
    const free = MEDIA_LIMITS.post.maxItems - items.length
    if (free <= 0) return
    for (const file of files.slice(0, free)) {
      const type = getMediaKind(file)
      const key = newKey()
      const base = { key, kind: 'new', type, file, progress: 0, previewUrl: URL.createObjectURL(file) }

      if (!type) {
        setItems((list) => [...list, { ...base, type: 'image', status: 'error', error: 'Formato não suportado.' }])
        continue
      }

      if (type === 'image') {
        if (file.size > MEDIA_LIMITS.image.maxOriginalSize) {
          setItems((list) => [...list, { ...base, status: 'error', error: `Imagem acima de ${formatBytes(MEDIA_LIMITS.image.maxOriginalSize)}.` }])
          continue
        }
        setItems((list) => [...list, { ...base, status: 'processing' }])
        try {
          const compressed = await compressImage(file, { fileType: MEDIA_LIMITS.output.post })
          const meta = await readImageMeta(compressed)
          update(key, { file: compressed, ...meta, status: 'ready', sizeLabel: formatBytes(compressed.size) })
        } catch {
          update(key, { status: 'error', error: 'Não foi possível processar a imagem.' })
        }
        continue
      }

      // vídeo
      if (file.size > MEDIA_LIMITS.postVideo.maxSize) {
        setItems((list) => [
          ...list,
          { ...base, status: 'error', error: `Vídeo acima de ${formatBytes(MEDIA_LIMITS.postVideo.maxSize)}. Comprima antes de enviar.` },
        ])
        continue
      }
      setItems((list) => [...list, { ...base, status: 'processing' }])
      try {
        const meta = await readVideoMeta(file)
        if (meta.duration > MEDIA_LIMITS.postVideo.maxDuration) {
          update(key, { status: 'error', error: `Vídeo com mais de ${formatDuration(MEDIA_LIMITS.postVideo.maxDuration)}.` })
        } else {
          update(key, { ...meta, status: 'ready', sizeLabel: formatBytes(file.size) })
        }
      } catch (e) {
        update(key, { status: 'error', error: e.message })
      }
    }
  }

  const move = (index, dir) => {
    setItems((list) => {
      const next = [...list]
      const target = index + dir
      if (target < 0 || target >= next.length) return list
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const remove = (item) => {
    if (item.kind === 'new' && item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    setItems((list) => list.filter((it) => it.key !== item.key))
    onRemove?.(item)
  }

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <div>
          <span className={styles.label}>Fotos e vídeos</span>
          <p className={styles.hint}>
            Até {MEDIA_LIMITS.post.maxItems} itens. Imagens são reduzidas para {MEDIA_LIMITS.image.maxDimension}px. Vídeos até{' '}
            {formatDuration(MEDIA_LIMITS.postVideo.maxDuration)} e {formatBytes(MEDIA_LIMITS.postVideo.maxSize)} (prefira MP4 já comprimido).
          </p>
        </div>
        <Button
          variant="secondary"
          icon="upload"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || items.length >= MEDIA_LIMITS.post.maxItems}
        >
          Adicionar
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {items.length === 0 ? (
        <button type="button" className={styles.dropzone} onClick={() => inputRef.current?.click()} disabled={disabled}>
          <Icon name="image" size={28} />
          Toque para escolher fotos e vídeos
        </button>
      ) : (
        <ol className={styles.grid}>
          {items.map((item, index) => (
            <li key={item.key} className={cn(styles.item, item.status === 'error' && styles.itemError)}>
              <div className={styles.preview}>
                {item.type === 'video' ? (
                  <video src={item.previewUrl} muted playsInline preload="metadata" aria-hidden="true" />
                ) : (
                  <img src={item.previewUrl} alt="" />
                )}
                <span className={styles.position}>{index + 1}</span>
                {item.type === 'video' && (
                  <span className={styles.badge}>
                    <Icon name="video" size={14} /> {item.duration ? formatDuration(item.duration) : ''}
                  </span>
                )}
                {item.status === 'processing' && (
                  <span className={styles.overlay}>
                    <Loader size="sm" inline /> Processando…
                  </span>
                )}
              </div>
              <div className={styles.meta}>
                {item.status === 'error' && <p className={styles.error}>{item.error}</p>}
                {item.status === 'uploading' && <ProgressBar value={item.progress} label={`Envio do item ${index + 1}`} />}
                {item.status === 'ready' && <p className={styles.small}>Pronto para enviar · {item.sizeLabel}</p>}
                {item.status === 'done' && item.kind === 'existing' && <p className={styles.small}>Salvo</p>}
              </div>
              <div className={styles.actions}>
                <Button variant="ghost" size="sm" iconOnly icon="chevronLeft" aria-label={`Mover item ${index + 1} para antes`} onClick={() => move(index, -1)} disabled={disabled || index === 0} />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon="chevronRight"
                  aria-label={`Mover item ${index + 1} para depois`}
                  onClick={() => move(index, 1)}
                  disabled={disabled || index === items.length - 1}
                />
                <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label={`Remover item ${index + 1}`} onClick={() => remove(item)} disabled={disabled} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
