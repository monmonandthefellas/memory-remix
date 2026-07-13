import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react()],
  // Keep logs in dev, strip in production bundle.
  esbuild: command === 'build'
    ? { drop: ['console', 'debugger'] }
    : undefined,
  server: {
    port: 5173,
    open: '/index.html',
    cors: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        widget: 'src/main.jsx',
        landing: 'js/main.js',
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'widget') return 'bundle.js'
          if (chunkInfo.name === 'landing') return 'js/main.js'
          return 'assets/[name].js'
        },
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    cssCodeSplit: false,
  },
}))


