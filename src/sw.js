/* eslint-env serviceworker */
// =====================================================================
// Service worker do PWA (vite-plugin-pwa, estratégia injectManifest)
// - precache dos assets do build (JS, CSS, ícones)
// - navegação: rede primeiro; sem rede, página em cache ou offline.html
// - mídia do Supabase Storage: cache com expiração
// - push (Fase 5): handlers já preparados
// =====================================================================
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Páginas (SPA): tenta a rede; se cair, usa a última versão em cache
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 4,
      plugins: [new ExpirationPlugin({ maxEntries: 30 })],
    }),
    { denylist: [/^\/api\//] },
  ),
)

// Imagens e vídeos públicos do Supabase Storage
registerRoute(
  ({ url, request }) =>
    url.pathname.includes('/storage/v1/object/public/') && request.destination === 'image',
  new CacheFirst({
    cacheName: 'media-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 })],
  }),
)

// Fontes e imagens locais
registerRoute(
  ({ request }) => request.destination === 'font' || request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'static-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 60 })],
  }),
)

// Sem rede e sem cache: página offline simples
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    return (await matchPrecache('/offline.html')) || Response.error()
  }
  return Response.error()
})

// ---------------------------------------------------------------------
// Push (Fase 5 - opcional). Já preparado: quando o back-end enviar um
// push com { title, body, url }, a notificação aparece e abre a URL.
// ---------------------------------------------------------------------
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Bloco Diz Que É', body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Bloco Diz Que É', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c)
      if (open) {
        open.navigate(url)
        return open.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
