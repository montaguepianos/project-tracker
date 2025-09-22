/// <reference types="vitest" />

import { defineConfig } from 'vite'
import type { UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))

const config = {
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: resolve(root, 'vitest.setup.ts'),
  },
}

export default defineConfig(config as unknown as UserConfig)
