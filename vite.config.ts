/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = import.meta.dirname

// One build emits the unpacked extension into dist/: manifest.json (copied from
// public/), popup.html, app.html, and background.js at the root, where the
// manifest expects them, with page bundles under assets/.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The polyfill calls fetch; extension pages make no network requests.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: {
        popup: resolve(rootDir, 'popup.html'),
        app: resolve(rootDir, 'app.html'),
        background: resolve(rootDir, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background'
            ? 'background.js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
})
