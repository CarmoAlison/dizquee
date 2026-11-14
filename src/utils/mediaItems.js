// Converte a mídia salva no banco em itens do gerenciador de mídia (admin)
import { BUCKETS, getPublicUrl } from '../services/storageService'

export function toMediaItems(media) {
  return (media || []).map((m) => ({
    key: m.id,
    id: m.id,
    kind: 'existing',
    type: m.type,
    storage_path: m.storage_path,
    previewUrl: getPublicUrl(BUCKETS.POST_MEDIA, m.storage_path),
    width: m.width,
    height: m.height,
    duration: m.duration,
    position: m.position,
    status: 'done',
    progress: 100,
  }))
}

