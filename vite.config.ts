import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 650, rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
