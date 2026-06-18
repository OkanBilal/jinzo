import { app, safeStorage } from "electron";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import {
  ok,
  fail,
  type ServiceResponse,
} from "../../../shared/ipc-kit/service-response";

/**
 * Encrypted at-rest storage for direct-mode backend pairing tokens, keyed by
 * backend id. Tokens are encrypted with the OS keychain via Electron
 * `safeStorage` (same approach as connection credentials) and kept in a small
 * JSON map under userData — never in the renderer's localStorage.
 *
 * SSH-launch tokens are ephemeral and never reach here (see ssh.service).
 * See docs/design/remote-backend.md (pairing token).
 */

function tokenFilePath(): string {
  return path.join(app.getPath("userData"), "backend-tokens.json");
}

async function readMap(): Promise<Record<string, string>> {
  try {
    const text = await readFile(tokenFilePath(), "utf-8");
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, string>): Promise<void> {
  await mkdir(path.dirname(tokenFilePath()), { recursive: true });
  await writeFile(tokenFilePath(), JSON.stringify(map), "utf-8");
}

function encrypt(token: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(token).toString("base64");
  }
  // Best-effort fallback when the OS keychain is unavailable.
  return Buffer.from(token, "utf-8").toString("base64");
}

function decrypt(stored: string): string {
  const buffer = Buffer.from(stored, "base64");
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buffer);
    } catch {
      return buffer.toString("utf-8");
    }
  }
  return buffer.toString("utf-8");
}

export const backendAuthService = {
  async setToken(id: string, token: string): Promise<ServiceResponse<void>> {
    try {
      const map = await readMap();
      map[id] = encrypt(token);
      await writeMap(map);
      return ok(undefined);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to store token",
      );
    }
  },

  async getToken(id: string): Promise<ServiceResponse<string | null>> {
    try {
      const map = await readMap();
      const stored = map[id];
      return ok(stored ? decrypt(stored) : null);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to read token",
      );
    }
  },

  async deleteToken(id: string): Promise<ServiceResponse<void>> {
    try {
      const map = await readMap();
      delete map[id];
      await writeMap(map);
      return ok(undefined);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to delete token",
      );
    }
  },
};
