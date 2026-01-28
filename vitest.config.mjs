import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true, // 讓我們可以直接用 describe, it, expect，不用每次 import
    setupFiles: './vitest.setup.mjs', // 設定檔路徑
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
