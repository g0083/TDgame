import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Base path for the built assets.
 *
 * - GitHub Pages project site (https://<user>.github.io/TDgame/):
 *   set VITE_BASE=/TDgame/  (or leave unset - the default below handles it)
 * - Custom domain / user site (https://<user>.github.io/):
 *   set VITE_BASE=/
 *
 * The default is the repository-agnostic relative './', which resolves
 * correctly under any sub-path, and is what GitHub Pages needs.
 */
const BASE = process.env.VITE_BASE ?? './'

export default defineConfig({
  base: BASE,
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'favicon.ico'],
      manifest: {
        id: './',
        name: 'Aegis TD — Simple Tower Defense',
        short_name: 'Aegis TD',
        description:
          'A simple-graphics tower defense game with 12 towers, 17 enemies, 6 stages, endless mode, research lab and daily challenges. Playable offline.',
        lang: 'ja',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#0b1020',
        theme_color: '#0b1020',
        categories: ['games', 'strategy'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
})
