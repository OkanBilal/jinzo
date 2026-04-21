import { ipcMain } from "electron";
import { appSettingsController } from "./appSettings.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerAppSettingsIpc() {
  ipcMain.handle("appSettings:get", () => appSettingsController.get());
  ipcMain.handle("appSettings:setActiveSpace", (_, spaceId) => appSettingsController.setActiveSpace(spaceId));
  ipcMain.handle("appSettings:setEnableWorktrees", (_, enabled) => appSettingsController.setEnableWorktrees(enabled));
  ipcMain.handle("appSettings:setShowToolCalls", (_, enabled) => appSettingsController.setShowToolCalls(enabled));
  ipcMain.handle("appSettings:setPreventSleepDuringRuns", (_, enabled) => appSettingsController.setPreventSleepDuringRuns(enabled));
  ipcMain.handle("appSettings:setNotifyOnRunComplete", (_, enabled) => appSettingsController.setNotifyOnRunComplete(enabled));
  ipcMain.handle("appSettings:setNotifyOnToolApproval", (_, enabled) => appSettingsController.setNotifyOnToolApproval(enabled));
  ipcMain.handle("appSettings:setShowMenuBarIcon", (_, enabled) => appSettingsController.setShowMenuBarIcon(enabled));
  ipcMain.handle("appSettings:setCommitInstructions", (_, instructions) => appSettingsController.setCommitInstructions(instructions));
  ipcMain.handle("appSettings:setPrInstructions", (_, instructions) => appSettingsController.setPrInstructions(instructions));

}

export function unregisterAppSettingsIpc() {
  ipcMain.removeHandler("appSettings:get");
  ipcMain.removeHandler("appSettings:setActiveSpace");
  ipcMain.removeHandler("appSettings:setEnableWorktrees");
  ipcMain.removeHandler("appSettings:setShowToolCalls");
  ipcMain.removeHandler("appSettings:setPreventSleepDuringRuns");
  ipcMain.removeHandler("appSettings:setNotifyOnRunComplete");
  ipcMain.removeHandler("appSettings:setNotifyOnToolApproval");
  ipcMain.removeHandler("appSettings:setShowMenuBarIcon");
  ipcMain.removeHandler("appSettings:setCommitInstructions");
  ipcMain.removeHandler("appSettings:setPrInstructions");
}
