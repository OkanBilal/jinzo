import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
  },
}));

import { updatesService } from "./updates.service";
import { BrowserWindow } from "electron";

describe("updatesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatesService._state = { status: "idle", info: null, progress: null, error: null };
    updatesService._initialized = false;
  });

  // ───────────────────────────────────────────────
  // getStatus
  // ───────────────────────────────────────────────
  describe("getStatus", () => {
    it("returns current state", () => {
      const result = updatesService.getStatus();
      expect(result).toEqual({
        success: true,
        data: { status: "idle", info: null, progress: null, error: null },
      });
    });

    it("returns a copy of state (not reference)", () => {
      const result = updatesService.getStatus();
      if (result.success) {
        result.data.status = "checking";
        expect(updatesService._state.status).toBe("idle");
      }
    });

    it("reflects updated state", () => {
      updatesService._state = { status: "downloaded", info: { version: "3.0.0" }, progress: null, error: null };
      const result = updatesService.getStatus();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("downloaded");
        expect(result.data.info?.version).toBe("3.0.0");
      }
    });
  });

  // ───────────────────────────────────────────────
  // _updateState
  // ───────────────────────────────────────────────
  describe("_updateState", () => {
    it("updates internal state", () => {
      updatesService._updateState({ status: "checking", info: null, progress: null, error: null });
      expect(updatesService._state.status).toBe("checking");
    });

    it("broadcasts to all non-destroyed windows", () => {
      const mockWin1 = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      const mockWin2 = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWin1 as any, mockWin2 as any]);

      const newState = { status: "available" as const, info: { version: "2.0.0" }, progress: null, error: null };
      updatesService._updateState(newState);

      expect(mockWin1.webContents.send).toHaveBeenCalledWith("updates:status", newState);
      expect(mockWin2.webContents.send).toHaveBeenCalledWith("updates:status", newState);
    });

    it("skips destroyed windows", () => {
      const mockWin = {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: { send: vi.fn() },
      };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWin as any]);

      updatesService._updateState({ status: "idle", info: null, progress: null, error: null });
      expect(mockWin.webContents.send).not.toHaveBeenCalled();
    });

    it("handles mix of destroyed and alive windows", () => {
      const destroyed = { isDestroyed: vi.fn().mockReturnValue(true), webContents: { send: vi.fn() } };
      const alive = { isDestroyed: vi.fn().mockReturnValue(false), webContents: { send: vi.fn() } };
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([destroyed as any, alive as any]);

      updatesService._updateState({ status: "error", info: null, progress: null, error: "fail" });
      expect(destroyed.webContents.send).not.toHaveBeenCalled();
      expect(alive.webContents.send).toHaveBeenCalled();
    });

    it("handles no windows", () => {
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);
      expect(() => {
        updatesService._updateState({ status: "idle", info: null, progress: null, error: null });
      }).not.toThrow();
    });
  });

  // ───────────────────────────────────────────────
  // initialize (dev mode)
  // ───────────────────────────────────────────────
  describe("initialize", () => {
    it("sets _initialized to true", () => {
      updatesService.initialize();
      expect(updatesService._initialized).toBe(true);
    });

    it("does not re-initialize on second call", () => {
      updatesService.initialize();
      updatesService._initialized = true;
      // Second call is a no-op (would fail if it tried to require electron-updater)
      updatesService.initialize();
      expect(updatesService._initialized).toBe(true);
    });

    it("skips auto-updater setup in dev mode", () => {
      // In dev mode (app.isPackaged = false), it returns early without require("electron-updater")
      expect(() => updatesService.initialize()).not.toThrow();
    });
  });

  // ───────────────────────────────────────────────
  // checkForUpdates (dev mode)
  // ───────────────────────────────────────────────
  describe("checkForUpdates", () => {
    it("returns not-available in dev mode", async () => {
      const result = await updatesService.checkForUpdates();
      expect(result).toEqual({
        success: true,
        data: { status: "not-available", info: null, progress: null, error: null },
      });
    });

    it("updates internal state to not-available in dev mode", async () => {
      await updatesService.checkForUpdates();
      expect(updatesService._state.status).toBe("not-available");
    });
  });

  // ───────────────────────────────────────────────
  // downloadUpdate (dev mode)
  // ───────────────────────────────────────────────
  describe("downloadUpdate", () => {
    it("returns error in dev mode", async () => {
      const result = await updatesService.downloadUpdate();
      expect(result).toEqual({ success: false, error: "Cannot download updates in development mode" });
    });
  });

  // ───────────────────────────────────────────────
  // quitAndInstall (dev mode)
  // ───────────────────────────────────────────────
  describe("quitAndInstall", () => {
    it("returns error in dev mode", () => {
      const result = updatesService.quitAndInstall();
      expect(result).toEqual({ success: false, error: "Cannot install updates in development mode" });
    });
  });

  // ───────────────────────────────────────────────
  // State transitions (testing _updateState flows)
  // ───────────────────────────────────────────────
  describe("state transitions", () => {
    it("checking → available → downloading → downloaded", () => {
      updatesService._updateState({ status: "checking", info: null, progress: null, error: null });
      expect(updatesService._state.status).toBe("checking");

      updatesService._updateState({
        status: "available",
        info: { version: "2.0.0", releaseDate: "2024-01-01", releaseNotes: "Bug fixes" },
        progress: null,
        error: null,
      });
      expect(updatesService._state.status).toBe("available");
      expect(updatesService._state.info?.version).toBe("2.0.0");

      updatesService._updateState({
        status: "downloading",
        info: { version: "2.0.0" },
        progress: { percent: 50, bytesPerSecond: 1024, transferred: 512, total: 1024 },
        error: null,
      });
      expect(updatesService._state.status).toBe("downloading");
      expect(updatesService._state.progress?.percent).toBe(50);

      updatesService._updateState({
        status: "downloaded",
        info: { version: "2.0.0" },
        progress: null,
        error: null,
      });
      expect(updatesService._state.status).toBe("downloaded");
    });

    it("checking → error preserves info", () => {
      updatesService._state.info = { version: "2.0.0" };
      updatesService._updateState({
        status: "error",
        info: updatesService._state.info,
        progress: null,
        error: "Network failed",
      });
      expect(updatesService._state.status).toBe("error");
      expect(updatesService._state.error).toBe("Network failed");
      expect(updatesService._state.info?.version).toBe("2.0.0");
    });

    it("not-available resets everything", () => {
      updatesService._state = {
        status: "available",
        info: { version: "1.0.0" },
        progress: null,
        error: null,
      };
      updatesService._updateState({ status: "not-available", info: null, progress: null, error: null });
      expect(updatesService._state).toEqual({ status: "not-available", info: null, progress: null, error: null });
    });
  });
});
