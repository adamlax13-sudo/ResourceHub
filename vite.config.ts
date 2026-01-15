import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'client'), // <-- folder with index.html
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
  build: {
    outDir: path.resolve(__dirname, "client/src"), // output for Express to serve
    emptyOutDir: true
  }
});

