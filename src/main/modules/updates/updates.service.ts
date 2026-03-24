import { app, autoUpdater, BrowserWindow } from "electron";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";
import type {
  UpdateState,
  ServiceResponse,
} from "./updates.dto";

// ─────────────────────────────────────────────────────────────
// Service - Auto-update business logic using update-electron-app
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

    // Register event listeners to push state to renderer
    autoUpdater.on("checking-for-update", () => {
      this._updateState({ status: "checking", info: null, progress: null, error: null });
    });

    autoUpdater.on("update-available", () => {
      this._updateState({ status: "available", info: null, progress: null, error: null });
    });

    autoUpdater.on("update-not-available", () => {
      this._updateState({ status: "not-available", info: null, progress: null, error: null });
    });

    autoUpdater.on("update-downloaded", (_event: any, _releaseNotes: string, releaseName: string) => {
      this._updateState({
        status: "downloaded",
        info: { version: releaseName || "new version" },
        progress: null,
        error: null,
      });
    });

    autoUpdater.on("error", (err: Error) => {
      // "command is disabled" means updater is already busy — not a real error
      if (err.message?.includes("command is disabled")) return;

      this._updateState({
        status: "error",
        info: this._state.info,
        progress: null,
        error: err.message,
      });
    });

    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: "OkanBilal/jinzo",
      },
      updateInterval: "1 hour",
      notifyUser: false,
    });
  },

  async checkForUpdates(): Promise<ServiceResponse<UpdateState>> {
    if (!app.isPackaged) {
      this._state = { status: "not-available", info: null, progress: null, error: null };
      return { success: true, data: this._state };
    }

    try {
      autoUpdater.checkForUpdates();
      return { success: true, data: this._state };
    } catch (err: any) {
      this._updateState({
        status: "error",
        info: null,
        progress: null,
        error: err.message || "Failed to check for updates",
      });
      return { success: true, data: this._state };
    }
  },

  async downloadUpdate(): Promise<ServiceResponse<UpdateState>> {
    return { success: true, data: this._state };
  },

  quitAndInstall(): ServiceResponse<null> {
    if (!app.isPackaged) {
      return { success: false, error: "Cannot install updates in development mode" };
    }

    autoUpdater.quitAndInstall();
    return { success: true, data: null };
  },

  getStatus(): ServiceResponse<UpdateState> {
    return { success: true, data: { ...this._state } };
  },

  _updateState(newState: UpdateState) {
    this._state = newState;

    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("updates:status", newState);
      }
    }
  },
};
