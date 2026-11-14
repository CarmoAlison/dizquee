// Recorte quadrado da foto de perfil: arrastar para posicionar e zoom.
// Também funciona pelo teclado (setas movem, +/- zoom).
import { useCallback, useEffect, useRef, useState } from 'react'
import { cropImageToBlob } from '../../../utils/imageCompression'
import { Button } from '../../common/Button/Button'
import { Modal } from '../../common/Modal/Modal'
import styles from './AvatarPicker.module.css'

const VIEW = 280

export function AvatarCropper({ file, open, onCancel, onConfirm, outputSize = 512, title = 'Ajustar foto' }) {
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const dragRef = useRef(null)

  useEffect(() => {
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImage(img)
      setZoom(1)
      const s = VIEW / Math.min(img.naturalWidth, img.naturalHeight)
      setOffset({ x: (VIEW - img.naturalWidth * s) / 2, y: (VIEW - img.naturalHeight * s) / 2 })
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const scale = image ? (VIEW / Math.min(image.naturalWidth, image.naturalHeight)) * zoom : 1

  const clamp = useCallback(
    (pos, s = scale) => {
      if (!image) return pos
      const w = image.naturalWidth * s
      const h = image.naturalHeight * s
      return {
        x: Math.min(0, Math.max(VIEW - w, pos.x)),
        y: Math.min(0, Math.max(VIEW - h, pos.y)),
      }
    },
    [image, scale],
  )

  const changeZoom = (nextZoom) => {
    if (!image) return
    const z = Math.min(3, Math.max(1, nextZoom))
    const base = VIEW / Math.min(image.naturalWidth, image.naturalHeight)
    const oldScale = base * zoom
    const newScale = base * z
    // mantém o centro
    const cx = (VIEW / 2 - offset.x) / oldScale
    const cy = (VIEW / 2 - offset.y) / oldScale
    setZoom(z)
    setOffset(clamp({ x: VIEW / 2 - cx * newScale, y: VIEW / 2 - cy * newScale }, newScale))
  }

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: offset }
  }
  const onPointerMove = (e) => {
    if (!dragRef.current) return
    const { startX, startY, origin } = dragRef.current
    setOffset(clamp({ x: origin.x + e.clientX - startX, y: origin.y + e.clientY - startY }))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }
  const onKeyDown = (e) => {
    const step = 10
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[e.key]) {
      e.preventDefault()
      setOffset((o) => clamp({ x: o.x + moves[e.key][0], y: o.y + moves[e.key][1] }))
    }
    if (e.key === '+' || e.key === '=') changeZoom(zoom + 0.1)
    if (e.key === '-') changeZoom(zoom - 0.1)
  }

  const handleConfirm = async () => {
    if (!image) return
    setSaving(true)
    try {
      const blob = await cropImageToBlob(
        image,
        { x: -offset.x / scale, y: -offset.y / scale, size: VIEW / scale },
        { outputSize, type: 'image/webp', quality: 0.85 },
      )
      onConfirm(blob)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} loading={saving} disabled={!image}>
            Usar esta foto
          </Button>
        </>
      }
    >
      <div className={styles.cropArea}>
        <div
          className={styles.viewport}
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="application"
          aria-label="Área de recorte. Arraste ou use as setas para posicionar; + e - para zoom."
        >
          {image && (
            <img
              src={image.src}
              alt=""
              draggable={false}
              className={styles.cropImage}
              style={{
                width: image.naturalWidth * scale,
                height: image.naturalHeight * scale,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          <span className={styles.mask} aria-hidden="true" />
        </div>
        <label className={styles.zoom}>
          <span>Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
          />
        </label>
      </div>
    </Modal>
  )
}
