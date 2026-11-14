// Escolha da foto de perfil (opcional) com recorte/redimensionamento
import { useEffect, useRef, useState } from 'react'
import { MEDIA_LIMITS } from '../../../constants/mediaLimits'
import { useToast } from '../../../hooks/useToast'
import { formatBytes } from '../../../utils/mediaUtils'
import { Avatar } from '../../common/Avatar/Avatar'
import { Button } from '../../common/Button/Button'
import { AvatarCropper } from './AvatarCropper'
import styles from './AvatarPicker.module.css'

/** onChange(blob | null) */
export function AvatarPicker({ currentUrl, name, onChange, label = 'Foto de perfil (opcional)' }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const onSelect = (e) => {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (!selected) return
    if (!selected.type.startsWith('image/')) {
      toast.error('Escolha uma imagem (JPG, PNG ou WebP).')
      return
    }
    if (selected.size > MEDIA_LIMITS.image.maxOriginalSize) {
      toast.error(`Imagem muito grande. Máximo de ${formatBytes(MEDIA_LIMITS.image.maxOriginalSize)}.`)
      return
    }
    setFile(selected)
  }

  const onCropped = (blob) => {
    setFile(null)
    setPreview(URL.createObjectURL(blob))
    onChange(blob)
  }

  const remove = () => {
    setPreview('')
    onChange(null)
  }

  return (
    <div className={styles.picker}>
      <Avatar src={preview || currentUrl} name={name} size={72} />
      <div className={styles.pickerText}>
        <span className={styles.pickerLabel}>{label}</span>
        <div className={styles.pickerActions}>
          <Button variant="secondary" size="sm" icon="camera" onClick={() => inputRef.current?.click()}>
            {preview || currentUrl ? 'Trocar foto' : 'Escolher foto'}
          </Button>
          {preview && (
            <Button variant="ghost" size="sm" onClick={remove}>
              Remover
            </Button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onSelect} />
      <AvatarCropper
        file={file}
        open={Boolean(file)}
        onCancel={() => setFile(null)}
        onConfirm={onCropped}
        outputSize={MEDIA_LIMITS.avatar.size}
      />
    </div>
  )
}
