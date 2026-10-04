import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'favicon.svg'],
      workbox: {
        // Cache Google Fonts for offline use
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Precache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Life OS',
        short_name: 'LifeOS',
        description: 'Your Personal Life Operating System',
        start_url: '/',
        scope: '/',
        id: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0A0F1E',
        theme_color: '#6366F1',
        categories: ['productivity', 'lifestyle', 'finance', 'health'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Add Expense',
            short_name: 'Expense',
            description: 'Log a new expense quickly',
            url: '/finance',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Log Time',
            short_name: 'Time',
            description: 'Track your time activities',
            url: '/timeflow',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Habits',
            short_name: 'Habits',
            description: "Check today's habits",
            url: '/habits',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'AI Chat',
            short_name: 'AI',
            description: 'Chat with AI assistant',
            url: '/ai',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
})