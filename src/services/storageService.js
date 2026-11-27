// Upload com barra de progresso (XHR direto na API do Storage, pois o
// supabase-js não informa progresso), URLs públicas e remoção.
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabaseClient'

export const BUCKETS = {
  AVATARS: 'avatars',
  POST_MEDIA: 'post-media',
  STORY_MEDIA: 'story-media',
  HIGHLIGHT_COVERS: 'highlight-covers',
  BRAND: 'brand',
  PRODUCT_IMAGES: 'product-images',
}

const TRANSFORM_ENABLED = import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === 'true'

function encodePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/')
}

export function getPublicUrl(bucket, path, { width } = {}) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  if (width && TRANSFORM_ENABLED) {
    return `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${encodePath(path)}?width=${width}&quality=75&resize=contain`
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodePath(path)}`
}

// srcset para imagens (somente com Image Transformations do Supabase)
export function getSrcSet(bucket, path, widths = [480, 768, 1080, 1600]) {
  if (!TRANSFORM_ENABLED || !path) return undefined
  return widths.map((w) => `${getPublicUrl(bucket, path, { width: w })} ${w}w`).join(', ')
}

/**
 * Envia um arquivo com progresso.
 * @returns {{ promise: Promise<string>, abort: () => void }} promise resolve com o path
 */
export function uploadWithProgress(bucket, path, file, onProgress) {
  const xhr = new XMLHttpRequest()
  const promise = (async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.')

    return new Promise((resolve, reject) => {
      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodePath(path)}`)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY)
      xhr.setRequestHeader('x-upsert', 'false')
      xhr.setRequestHeader('cache-control', 'max-age=31536000')
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100)
          resolve(path)
        } else {
          let message = 'Falha no envio do arquivo.'
          try {
            const body = JSON.parse(xhr.responseText)
            if (/exceeded|too large|maximum allowed size/i.test(body.message || body.error || '')) {
              message = 'Arquivo maior que o limite permitido.'
            } else if (/mime|type/i.test(body.message || '')) {
              message = 'Formato de arquivo não permitido.'
            } else if (xhr.status === 403 || /security|policy/i.test(body.message || '')) {
              message = 'Você não tem permissão para enviar este arquivo.'
            }
          } catch {
            /* resposta sem JSON */
          }
          reject(new Error(message))
        }
      }
      xhr.onerror = () => reject(new Error('Sem conexão durante o envio. Tente novamente.'))
      xhr.onabort = () => reject(new Error('Envio cancelado.'))
      xhr.send(file)
    })
  })()
  return { promise, abort: () => xhr.abort() }
}

export async function removeFiles(bucket, paths) {
  const list = (paths || []).filter((p) => p && !/^https?:\/\//.test(p))
  if (!list.length) return
  const { error } = await supabase.storage.from(bucket).remove(list)
  if (error) throw error
}

export async function listFolder(bucket, folder) {
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 100 })
  if (error) throw error
  return (data || []).map((f) => `${folder}/${f.name}`)
}
