// Compressão/redimensionamento no navegador antes do upload.
// browser-image-compression: usa Web Worker (não trava a tela) e corrige
// a orientação EXIF de fotos do celular.
import imageCompression from 'browser-image-compression'
import { MEDIA_LIMITS } from '../constants/mediaLimits'

export async function compressImage(file, { fileType = 'image/webp', maxDimension, quality, onProgress } = {}) {
  const options = {
    maxWidthOrHeight: maxDimension || MEDIA_LIMITS.image.maxDimension,
    maxSizeMB: MEDIA_LIMITS.image.maxSizeAfterCompression / (1024 * 1024),
    initialQuality: quality || MEDIA_LIMITS.image.quality,
    fileType,
    useWebWorker: true,
    onProgress,
  }
  const compressed = await imageCompression(file, options)
  return new File([compressed], renameExtension(file.name, fileType), { type: fileType })
}

function renameExtension(name, type) {
  const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1]
  return `${String(name || 'imagem').replace(/\.[^.]+$/, '')}.${ext}`
}

// Recorta um quadrado (ou retângulo) de uma imagem usando canvas.
// crop = { x, y, size } em pixels da imagem original.
export async function cropImageToBlob(image, crop, { outputSize = 512, type = 'image/webp', quality = 0.85 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, outputSize, outputSize)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao recortar a imagem.'))), type, quality)
  })
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}
