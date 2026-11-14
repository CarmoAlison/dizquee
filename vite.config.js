import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// vite-plugin-pwa: gera o manifest e injeta a lista de precache no
// service worker próprio (src/sw.js), que já fica pronto para push (Fase 5).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'offline.html', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Bloco Diz Que É',
        short_name: 'Diz Que É',
        description: 'Novidades, fotos, vídeos e stories do bloco.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'portrait',
        theme_color: '#660385',
        background_color: '#660385',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        globIgnores: ['icons/og-default.png'],
      },
      devOptions: { enabled: false },
    }),
  ],
})
