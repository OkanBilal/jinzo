require('dotenv').config({ path: '.env.local' });
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');

module.exports = {
  hooks: {
    packageAfterPrune: async (_forgeConfig, buildPath) => {
      const { rebuild } = require('@electron/rebuild');
      const path = require('path');
      const fs = require('fs');
      const electronVersion = require('electron/package.json').version;

      // Rebuild native modules inside .vite/build/node_modules
      // (Vite copies pre-built modules from project node_modules which target
      // the system Node.js, not Electron — this is the only location the app loads from)
      const viteBuildPath = path.join(buildPath, '.vite', 'build');
      const vitePkgJson = path.join(viteBuildPath, 'package.json');
      fs.writeFileSync(vitePkgJson, JSON.stringify({
        dependencies: {
          'better-sqlite3': '*',
          'node-pty': '*',
        }
      }));
      console.log('Rebuilding native modules in .vite/build/node_modules...');
      await rebuild({ buildPath: viteBuildPath, electronVersion, force: true });
      fs.unlinkSync(vitePkgJson);

      console.log('Native modules rebuilt successfully');

      // Strip prebuilt binaries for other platforms to reduce bundle size
      const targetPlatform = `${process.platform}-${process.arch}`;
      console.log(`Stripping non-${targetPlatform} binaries...`);

      const viteNodeModules = path.join(buildPath, '.vite', 'build', 'node_modules');
      let totalSaved = 0;

      const stripDirs = [
        // node-pty prebuilds (~58 MB on darwin-arm64)
        path.join(viteNodeModules, 'node-pty', 'prebuilds'),
        // @github/copilot prebuilds (~24 MB)
        path.join(viteNodeModules, '@github', 'copilot', 'prebuilds'),
        // @github/copilot ripgrep binaries (~20 MB)
        path.join(viteNodeModules, '@github', 'copilot', 'ripgrep', 'bin'),
      ];

      const getDirSize = (dir) => {
        let size = 0;
        try {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
            if (entry.isFile()) {
              try { size += fs.statSync(path.join(entry.parentPath || entry.path, entry.name)).size; } catch {}
            }
          }
        } catch {}
        return size;
      };

      for (const parentDir of stripDirs) {
        if (!fs.existsSync(parentDir)) continue;
        for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
          if (entry.isDirectory() && entry.name !== targetPlatform) {
            const fullPath = path.join(parentDir, entry.name);
            const size = getDirSize(fullPath);
            fs.rmSync(fullPath, { recursive: true, force: true });
            totalSaved += size;
            console.log(`  ✓ Removed ${path.relative(viteNodeModules, fullPath)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
          }
        }
      }

      // Strip node-pty source/build artifacts not needed at runtime
      const ptyExtras = ['third_party', 'deps', 'src', 'scripts', 'node-addon-api'].map(
        d => path.join(viteNodeModules, 'node-pty', d)
      );
      for (const dir of ptyExtras) {
        if (fs.existsSync(dir)) {
          const size = getDirSize(dir);
          fs.rmSync(dir, { recursive: true, force: true });
          totalSaved += size;
          console.log(`  ✓ Removed node-pty/${path.basename(dir)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
        }
      }

      console.log(`Total saved: ${(totalSaved / 1024 / 1024).toFixed(1)} MB`);
    },
  },
  packagerConfig: {
    name: 'Jinzo',
    executableName: 'jinzo',
    appBundleId: 'build.jinzo.app', // TODO: change this to your own bundle ID
    asar: {
      unpack: '{**/*.node,**/copilot,**/spawn-helper,**/rg,**/*.wasm}',
      unpackDir: '.vite/build/node_modules/{node-pty,@github/copilot-darwin-arm64,@github/copilot/prebuilds,@github/copilot/ripgrep,@anthropic-ai/claude-agent-sdk/vendor}',
    },
    icon: 'src/renderer/public/icon',
    extraResource: [
      'src/main/db/migrations',
      'src/renderer/public/icon.png',
    ],
    ...((() => {
      const hasSigningVars = process.env.APPLE_ID && process.env.APPLE_PASSWORD && process.env.APPLE_TEAM_ID;
      const isRelease = process.env.CI || process.env.RELEASE;

      if (isRelease && !hasSigningVars) {
        throw new Error('Release build requires APPLE_ID, APPLE_PASSWORD, and APPLE_TEAM_ID for code signing');
      }
      if (!hasSigningVars) {
        console.warn('⚠ Skipping code signing — APPLE_ID not set (local dev build)');
        return {};
      }
      return {
        osxSign: {
          identity: 'Developer ID Application',
          optionsForFile: () => ({
            hardenedRuntime: true,
            entitlements: 'entitlements.plist',
            'entitlements-inherit': 'entitlements.plist',
          }),
        },
        osxNotarize: {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        },
      };
    })()),
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        format: 'ULFO',
        background: 'src/renderer/public/dmg-background.png',
        icon: 'src/renderer/public/icon.icns',
        contents: [
          { x: 180, y: 170, type: 'file', path: '' },
          { x: 480, y: 170, type: 'link', path: '/Applications' },
        ],
        window: { size: { width: 660, height: 400 } },
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'OkanBilal', name: 'jinzo' },
        prerelease: false,
        draft: true,
      },
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main/index.ts',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload/index.ts',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'renderer',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
