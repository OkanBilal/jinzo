/**
 * Global test setup — mocks Electron and other native modules
 * that are unavailable in the Vitest Node environment.
 */
import { vi } from "vitest";

// Mock `electron` — used by db/client.ts and connectionCredentials.utils.ts
vi.mock("electron", () => ({
  app: {
    isReady: () => true,
    whenReady: () => Promise.resolve(),
    getPath: (name: string) => `/tmp/jinzo-test/${name}`,
    isPackaged: false,
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s, "utf-8"),
    decryptString: (b: Buffer) => b.toString("utf-8"),
  },
}));
