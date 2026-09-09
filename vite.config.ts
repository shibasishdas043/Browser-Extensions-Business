import { defineConfig, Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { copyFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function copyManifestPlugin(): Plugin {
  return {
    name: 'copy-manifest',
    closeBundle() {
      const src = fileURLToPath(new URL('./manifest.json', import.meta.url));
      const dest = fileURLToPath(new URL('./dist/manifest.json', import.meta.url));
      copyFileSync(src, dest);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyManifestPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL('./popup/popup.html', import.meta.url)),
        options: fileURLToPath(new URL('./options/options.html', import.meta.url)),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});

