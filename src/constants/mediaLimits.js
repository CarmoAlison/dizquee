// =====================================================================
// Limites de mídia (fácil de mudar). Lembre: o plano gratuito do
// Supabase aceita no máximo 50 MB por arquivo, e os buckets têm limites
// próprios em supabase/migrations/0005_storage.sql.
// =====================================================================
const MB = 1024 * 1024

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

export const MEDIA_LIMITS = {
  // Imagens são comprimidas/redimensionadas no navegador antes do upload
  image: {
    maxOriginalSize: 25 * MB, // arquivo escolhido (antes de comprimir)
    maxDimension: 1600, // px no maior lado
    quality: 0.82,
    maxSizeAfterCompression: 1.5 * MB,
  },
  avatar: {
    size: 512, // recorte quadrado final (px)
    quality: 0.85,
  },
  highlightCover: {
    size: 400,
    quality: 0.85,
  },
  postVideo: {
    maxDuration: 180, // 3 minutos
    maxSize: 50 * MB,
  },
  storyVideo: {
    maxDuration: 30, // 30 segundos
    maxSize: 30 * MB,
  },
  post: {
    maxItems: 10, // fotos + vídeos por post
  },
  // Formato de saída das imagens.
  // Posts em JPEG: melhor compatibilidade com o preview do WhatsApp/Facebook.
  output: {
    post: 'image/jpeg',
    story: 'image/webp',
    avatar: 'image/webp',
  },
  // Tempo de exibição de um story de imagem (ms)
  storyImageDuration: 5000,
}
