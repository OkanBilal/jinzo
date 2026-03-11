import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/global-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/main/**"],
      exclude: ["src/main/**/*.ipc.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
    },
  },
});
