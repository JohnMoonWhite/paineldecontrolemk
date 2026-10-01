import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The app shows an "update available" prompt instead of switching versions silently.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'brand/mkhub.png'],
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
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
