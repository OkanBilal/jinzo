import { app, BrowserWindow } from "electron";
import type {
  UpdateState,
  ServiceResponse,
} from "./updates.dto";

// ─────────────────────────────────────────────────────────────
// Service - Auto-update business logic
// ─────────────────────────────────────────────────────────────
export const updatesService = {
  _state: {
    status: "idle",
    info: null,
    progress: null,
    error: null,
  } as UpdateState,

  _initialized: false,

  initialize() {
    if (this._initialized) return;
    this._initialized = true;

    if (!app.isPackaged) {
      console.log("Updates: skipping auto-updater in development mode");
      return;
    }

    // Dynamic import to avoid issues in dev mode where electron-updater
    // may not resolve correctly
    const { autoUpdater } = require("electron-updater");

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on("checking-for-update", () => {
      this._updateState({ status: "checking", info: null, progress: null, error: null });
    });

    autoUpdater.on("update-available", (info: any) => {
      this._updateState({
        status: "available",
        info: {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: typeof info.releaseNotes === "string"
            ? info.releaseNotes
            : undefined,
        },
        progress: null,
        error: null,
      });
    });

    autoUpdater.on("update-not-available", () => {
      this._updateState({ status: "not-available", info: null, progress: null, error: null });
    });

    autoUpdater.on("download-progress", (progress: any) => {
      this._updateState({
        ...this._state,
        status: "downloading",
        progress: {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total,
        },
      });
    });

    autoUpdater.on("update-downloaded", (info: any) => {
      this._updateState({
        status: "downloaded",
        info: {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: typeof info.releaseNotes === "string"
            ? info.releaseNotes
            : undefined,
        },
        progress: null,
        error: null,
      });
    });

    autoUpdater.on("error", (err: Error) => {
      this._updateState({
        status: "error",
        info: this._state.info,
        progress: null,
        error: err.message,
      });
    });
  },

  async checkForUpdates(): Promise<ServiceResponse<UpdateState>> {
    if (!app.isPackaged) {
      this._updateState({ status: "not-available", info: null, progress: null, error: null });
      return { success: true, data: this._state };
    }

    try {
      const { autoUpdater } = require("electron-updater");
      await autoUpdater.checkForUpdates();
      return { success: true, data: this._state };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to check for updates" };
    }
  },

  async downloadUpdate(): Promise<ServiceResponse<UpdateState>> {
    if (!app.isPackaged) {
      return { success: false, error: "Cannot download updates in development mode" };
    }

    try {
      const { autoUpdater } = require("electron-updater");
      await autoUpdater.downloadUpdate();
      return { success: true, data: this._state };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to download update" };
    }
  },

  quitAndInstall(): ServiceResponse<null> {
    if (!app.isPackaged) {
      return { success: false, error: "Cannot install updates in development mode" };
    }

    const { autoUpdater } = require("electron-updater");
    autoUpdater.quitAndInstall(false, true);
    return { success: true, data: null };
  },

  getStatus(): ServiceResponse<UpdateState> {
    return { success: true, data: { ...this._state } };
  },

  _updateState(newState: UpdateState) {
    this._state = newState;

    // Push status to all renderer windows
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("updates:status", newState);
      }
    }
  },
};
