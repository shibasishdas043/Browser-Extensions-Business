import { defineConfig, Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { copyFileSync } from 'node:fs';

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
  plugins: [copyManifestPlugin()],
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

