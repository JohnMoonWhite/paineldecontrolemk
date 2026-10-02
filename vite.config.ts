import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The app shows an "update available" prompt instead of switching versions silently.
      registerType: 'prompt',
      workbox: { importScripts: ['push-sw.js'] },
      includeAssets: ['icons/favicon-32.png', 'icons/favicon-48.png', 'icons/apple-touch-icon.png', 'brand/mkhub.png', 'brand/mkhub-lockup.png'],
      manifest: {
        name: 'MKHUB | Painel de controle',
        short_name: 'MKHUB',
        description: 'Seus projetos e assinaturas em um só lugar.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        id: '/',
        display: 'standalone',
        theme_color: '#08090d',
        background_color: '#08090d',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
