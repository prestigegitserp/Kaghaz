import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.VITE_PUBLIC_BASE || './',
  build: { target: 'es2022', chunkSizeWarningLimit: 650, rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
