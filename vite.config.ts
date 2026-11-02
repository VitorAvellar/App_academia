import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA = o navegador consegue "instalar" o app na tela inicial e ele abre offline.
    // O plugin gera o manifest e um service worker que guarda (precache) todos os arquivos
    // do app — inclusive o catálogo JSON e as imagens dos exercícios.
    VitePWA({
      registerType: 'autoUpdate', // quando houver versão nova, atualiza sozinho
      includeAssets: ['favicon.svg', 'exercise-images/*'],
      manifest: {
        name: 'Academia',
        short_name: 'Academia',
        description: 'Registro de treinos de musculação: fichas, cargas, séries e repetições.',
        lang: 'pt-BR',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone', // abre sem a barra do navegador, parecendo app nativo
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
