import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

/**
 * Welcher Stand läuft gerade?
 *
 * Die Versionsnummer allein sagt nichts — sie steht seit dem ersten Tag
 * auf 0.1.0. Was einen Build wirklich identifiziert, ist der Commit.
 * In der CI liefert GitHub ihn als Umgebungsvariable, lokal fragt git.
 */
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'lokal'
  }
}

// Eigene Domain (cafe.garciahub.de) → die App liegt im Wurzelverzeichnis.
// DEPLOY_BASE bleibt als Notausgang, falls wieder unter /<repo>/ ausgeliefert
// werden muss.
const BASE = process.env.DEPLOY_BASE ?? '/'

export default defineConfig({
  base: BASE,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@domain': fileURLToPath(new URL('./types/domain.ts', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Café — dein Dial-in',
        short_name: 'Café',
        description: 'Persönliches Dial-in-Werkzeug für Espresso, V60, AeroPress und French Press',
        lang: 'de',
        theme_color: '#faf4ea',
        background_color: '#faf4ea',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Die App macht keine Netzwerkanfragen zur Laufzeit —
        // alles wird beim ersten Laden gecacht.
        navigateFallback: `${BASE}index.html`,
        // Statische Dokumente (Cheat Sheet) nie durch die App-Shell ersetzen.
        navigateFallbackDenylist: [/asc-barista-cheatsheet\.html$/],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit()),
    __APP_BUILT__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
