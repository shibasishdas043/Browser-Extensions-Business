import { defineConfig, Plugin, build as viteBuild } from 'vite';
import { fileURLToPath } from 'node:url';
import { copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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

function removeCrossoriginPlugin(): Plugin {
  return {
    name: 'remove-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin(="[^"]*")?/g, '');
    },
  };
}

function buildContentScriptPlugin(): Plugin {
  let isBuilding = false;

  function addWatchFilesRecursively(context: any, dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          addWatchFilesRecursively(context, fullPath);
        } else {
          context.addWatchFile(fullPath);
        }
      }
    } catch {
      // Ignore if directory doesn't exist
    }
  }

  return {
    name: 'build-content-script',
    buildStart() {
      // Ensure Vite/Rollup watches content and features directories in watch mode
      try {
        const contentDir = fileURLToPath(new URL('./content', import.meta.url));
        const featuresDir = fileURLToPath(new URL('./features', import.meta.url));
        addWatchFilesRecursively(this, contentDir);
        addWatchFilesRecursively(this, featuresDir);
      } catch (err) {
        console.error('[build-content-script] Error watching files:', err);
      }
    },
    async closeBundle() {
      if (isBuilding) return;
      isBuilding = true;
      try {
        await viteBuild({
          configFile: false,
          resolve: {
            alias: {
              '@': fileURLToPath(new URL('./', import.meta.url)),
            },
          },
          build: {
            outDir: 'dist',
            emptyOutDir: false,
            modulePreload: false,
            minify: true,
            lib: {
              entry: fileURLToPath(new URL('./content/index.ts', import.meta.url)),
              name: 'ZenWebContent',
              formats: ['iife'],
              fileName: () => 'content.js',
            },
          },
        });
      } catch (err) {
        console.error('[build-content-script] Build error:', err);
      } finally {
        isBuilding = false;
      }
    },
  };
}

export default defineConfig({
  base: '',
  plugins: [react(), tailwindcss(), copyManifestPlugin(), removeCrossoriginPlugin(), buildContentScriptPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL('./popup/popup.html', import.meta.url)),
        options: fileURLToPath(new URL('./options/options.html', import.meta.url)),
        background: fileURLToPath(new URL('./background/background.ts', import.meta.url)),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});

