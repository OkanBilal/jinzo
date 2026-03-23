import { app, autoUpdater } from "electron";
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

    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: "OkanBilal/jinzo",
      },
      updateInterval: "1 hour",
      notifyUser: true,
    });
  },

  async checkForUpdates(): Promise<ServiceResponse<UpdateState>> {
    if (!app.isPackaged) {
      this._state = { status: "not-available", info: null, progress: null, error: null };
      return { success: true, data: this._state };
    }

    try {
      autoUpdater.checkForUpdates();
      this._state = { status: "checking", info: null, progress: null, error: null };
      return { success: true, data: this._state };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to check for updates" };
    }
  },

  async downloadUpdate(): Promise<ServiceResponse<UpdateState>> {
    // update-electron-app handles download automatically
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
};
