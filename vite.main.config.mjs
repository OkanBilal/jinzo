import { defineConfig } from 'vite';
import path from 'path';
import { copyFileSync, mkdirSync, readdirSync, existsSync, cpSync } from 'fs';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    // Some libs that can run in both Web and Node.js environments are shipped with both ESM and CJS, and make use of Node.js compatible modules.
    // In order to handle these modules, Electron needs to tell Vite to build for Node.js environments.
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
        'sqlite-vec',
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
          'sqlite-vec',
          'sqlite-vec-darwin-arm64',
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
});
