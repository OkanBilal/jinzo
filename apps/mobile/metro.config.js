const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// The @mains/* packages are file:-linked from outside the app root. There
// are no npm workspaces here (each app keeps its own node_modules), so Expo's
// monorepo auto-detection doesn't see them — Metro must watch their source.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../../packages")];

module.exports = config;
