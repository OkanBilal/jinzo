const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');

module.exports = {
  hooks: {
    packageAfterPrune: async (_forgeConfig, buildPath) => {
      const { rebuild } = require('@electron/rebuild');
      console.log('Rebuilding native modules for Electron...');
      await rebuild({
        buildPath,
        electronVersion: require('electron/package.json').version,
        force: true,
      });
      console.log('Native modules rebuilt successfully');
    },
  },
  packagerConfig: {
    name: 'Jinzo',
    executableName: 'jinzo',
    asar: {
      unpack: '{**/*.node,**/copilot,**/spawn-helper,**/rg,**/*.wasm}',
      unpackDir: '.vite/build/node_modules/{sqlite-vec-darwin-arm64,@github/copilot-darwin-arm64,@github/copilot/prebuilds,@github/copilot/ripgrep,@anthropic-ai/claude-agent-sdk/vendor}',
    },
    icon: 'src/renderer/public/icon',
    extraResource: [
      'src/main/db/migrations',
      'src/renderer/public/icon.png',
    ],
  },
  rebuildConfig: {
    force: true,
  },
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
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
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
