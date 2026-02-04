import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      workbox: {
        // Serve SPA shell for navigations; online-first strategy
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/$/, /^\/student(\/)?$/, /^\/admin(\/)?$/, /^\/security(\/)?$/],
        // Precache built route chunks and assets
  globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
  maximumFileSizeToCacheInBytes: 4.5 * 1024 * 1024, // keep precache leaner for faster install
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*$/,
            // Use NetworkFirst so failed requests don't show as offline unless network truly fails
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-get-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // App shell and route chunks - cache while revalidating to accelerate cold starts
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'script',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'route-chunks' },
          },
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'styles' },
          },
          // Specific caches for student profile and logs to improve offline experience
          {
            urlPattern: /\/api\/students\/me$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'student-profile', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /\/api\/students\/logs$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'student-logs',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Gate Pass & Security',
        short_name: 'GatePass',
        description: 'College Student Gate Pass & Security',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        start_url: '/',
        icons: [
          // Make sure these PNGs exist in frontend/public/icons
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('axios')) return 'vendor-axios';
            return 'vendor';
          }
        },
      },
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
