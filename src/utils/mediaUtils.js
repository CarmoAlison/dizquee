import { IMAGE_TYPES, VIDEO_TYPES } from '../constants/mediaLimits'

export function getMediaKind(file) {
  if (!file?.type) return null
  if (IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')) return 'image'
  if (VIDEO_TYPES.includes(file.type)) return 'video'
  return null
}

// Lê duração e dimensões de um vídeo local
export function readVideoMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      const meta = { duration: video.duration, width: video.videoWidth || null, height: video.videoHeight || null }
      URL.revokeObjectURL(url)
      resolve(meta)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler este vídeo. Tente MP4 (H.264).'))
    }
    video.src = url
  })
}

// Lê dimensões de uma imagem local
export function readImageMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const meta = { width: img.naturalWidth, height: img.naturalHeight }
      URL.revokeObjectURL(url)
      resolve(meta)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler esta imagem.'))
    }
    img.src = url
  })
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1).replace('.', ',')} MB` : `${Math.ceil(bytes / 1024)} KB`
}

export function formatDuration(seconds) {
  const s = Math.round(Number(seconds) || 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function fileExtension(type) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  }
  return map[type] || 'bin'
}
