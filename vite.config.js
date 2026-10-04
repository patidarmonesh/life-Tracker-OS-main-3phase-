import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  server: { host: '127.0.0.1', proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT || 8787}` } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts'; if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'motion' } } },
  },
  plugins: [react(), tailwindcss(), VitePWA({
    strategies: 'injectManifest', srcDir: 'src', filename: 'sw.js', registerType: 'prompt',
    includeAssets: ['icon-192.png', 'icon-512.png', 'favicon.svg'],
    injectManifest: { globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
    manifest: { name: 'LifeOS', short_name: 'LifeOS', description: 'Plan your day, live it, see how in-sync you were.', start_url: '/', scope: '/', id: '/', display: 'standalone', orientation: 'any', background_color: '#0A0F1E', theme_color: '#6366F1',
      icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
      share_target: { action: '/capture', method: 'GET', enctype: 'application/x-www-form-urlencoded', params: { title: 'title', text: 'text', url: 'url' } },
      shortcuts: [{ name: 'Plan today', url: '/plan' }, { name: 'Money', url: '/money' }, { name: 'Time Flow', url: '/time' }, { name: 'Capture', url: '/capture' }],
    },
  })],
})
