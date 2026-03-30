import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Travel rendering is the dominant heavy dependency, so keeping
          // Three.js in its own async chunk prevents it inflating the base app.
          three: ['three']
        }
      }
    }
  },
  server: {
    port: 5178
  }
});
