/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Tauri builds against a known webview, so there is no reason to ship the
// downlevelling a browser matrix would need: Edge WebView2 and WebKitGTK both
// speak modern JS, and Safari 13 is the floor for macOS.
const tauriPlatform = process.env.TAURI_ENV_PLATFORM
const buildTarget =
  tauriPlatform === 'windows' ? 'chrome105' : tauriPlatform ? 'safari13' : 'es2022'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Vite's default `VITE_` prefix plus Tauri's, so `tauri dev` can pass the
  // target triple through to the renderer when a build needs to branch on it.
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // The Rust crate has its own watcher; letting Vite walk target/ costs
      // several seconds of startup for files it can never serve.
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: buildTarget,
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    rollupOptions: {
      output: {
        // Vendor code changes on dependency bumps, app code changes daily.
        // Splitting them keeps an update from re-parsing React every launch.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['@tanstack/react-query', 'zustand'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
