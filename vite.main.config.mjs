// Vite Main Process configuration
import { defineConfig } from 'vite';
import path from 'path';
import { copyFileSync, mkdirSync, readdirSync, existsSync, cpSync } from 'fs';

// https://vitejs.dev/config
export default defineConfig(() => {
  return {
  resolve: {
    // Some libs that can run in both Web and Node.js environments are shipped with both ESM and CJS, and make use of Node.js compatible modules.
    // In order to handle these modules, Electron needs to tell Vite to build for Node.js environments.
    // This is a workaround to avoid issues with modules that are shipped with both ESM and CJS.
    browserField: false,
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        'node-pty',
        // `ws` conditionally require()s its optional native deps (bufferutil,
        // utf-8-validate). Externalize so rollup doesn't try to resolve them at
        // build time; ws falls back to pure JS when they're absent at runtime.
        'ws',
        'bufferutil',
        'utf-8-validate',
        '@anthropic-ai/claude-agent-sdk',
        '@github/copilot-sdk',
        '@github/copilot',
        '@github/copilot-darwin-arm64',
        '@openai/codex-sdk',
        'vscode-jsonrpc',
        'zod',
        '@img/sharp-darwin-arm64',
      ],
    },
  },
  plugins: [
    {
      name: 'copy-native-modules',
      closeBundle() {
        const destNodeModules = '.vite/build/node_modules';
        mkdirSync(destNodeModules, { recursive: true });

        // Native modules and their dependencies that must be available at runtime
        const modulesToCopy = [
          'better-sqlite3',
          'bindings',
          'file-uri-to-path',
          'node-addon-api',
          'node-pty',
          'vscode-jsonrpc',
          'zod',
          'ws',
        ];

        // Scoped packages need their parent @scope directory created
        const scopedModulesToCopy = [
          '@anthropic-ai/claude-agent-sdk',
          '@github/copilot-sdk',
          '@github/copilot',
          '@github/copilot-darwin-arm64',
          '@openai/codex-sdk',
          '@img/sharp-darwin-arm64',
        ];

        for (const mod of modulesToCopy) {
          const src = path.join('node_modules', mod);
          const dest = path.join(destNodeModules, mod);
          if (existsSync(src)) {
            cpSync(src, dest, { recursive: true });
            console.log(`  ✓ Copied ${mod}`);
          } else {
            console.warn(`  ⚠ ${mod} not found, skipping`);
          }
        }

        for (const mod of scopedModulesToCopy) {
          const src = path.join('node_modules', mod);
          const scopeDir = path.join(destNodeModules, mod.split('/')[0]);
          const dest = path.join(destNodeModules, mod);
          if (existsSync(src)) {
            mkdirSync(scopeDir, { recursive: true });
            cpSync(src, dest, { recursive: true });
            console.log(`  ✓ Copied ${mod}`);
          } else {
            console.warn(`  ⚠ ${mod} not found, skipping`);
          }
        }
      }
    },
    {
      name: 'copy-migrations',
      closeBundle() {
        const srcDir = 'src/main/db/migrations';
        const destDir = '.vite/build/db/migrations';

        if (existsSync(srcDir)) {
          mkdirSync(destDir, { recursive: true });
          const items = readdirSync(srcDir, { withFileTypes: true });

          items.forEach(item => {
            const srcPath = path.join(srcDir, item.name);
            const destPath = path.join(destDir, item.name);

            if (item.isDirectory()) {
              // Copy meta directory
              mkdirSync(destPath, { recursive: true });
              readdirSync(srcPath).forEach(metaFile => {
                copyFileSync(path.join(srcPath, metaFile), path.join(destPath, metaFile));
              });
            } else if (item.name.endsWith('.sql')) {
              // Copy SQL files
              copyFileSync(srcPath, destPath);
            }
          });
          console.log('✓ Migrations copied to build directory');
        }
      }
    }
  ],
};
});
