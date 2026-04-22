import { ipcMain } from "electron";
import { browserController } from "./browser.controller";
import type { BrowserBounds } from "./browser.dto";

const CHANNELS = {
  ATTACH: "browser:attach",
  DETACH: "browser:detach",
  DESTROY: "browser:destroy",
  SET_BOUNDS: "browser:setBounds",
  SET_VISIBLE: "browser:setVisible",
  NAVIGATE: "browser:navigate",
  BACK: "browser:back",
  FORWARD: "browser:forward",
  RELOAD: "browser:reload",
  STOP: "browser:stop",
  SET_SELECT_MODE: "browser:setSelectMode",
  GET_NAV_STATE: "browser:getNavState",
  DELETE_CAPTURE: "browser:deleteCapture",
} as const;

function validBounds(input: unknown): BrowserBounds | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  const nums = ["x", "y", "width", "height"].map((k) => b[k]);
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return {
    x: b.x as number,
    y: b.y as number,
    width: b.width as number,
    height: b.height as number,
  };
}

export function registerBrowserIpc(): void {
  ipcMain.handle(CHANNELS.ATTACH, async (_, payload: unknown) => {
    const bounds = validBounds(payload);
    if (!bounds) return { success: false, error: "Invalid bounds" };
    return browserController.attach(bounds);
  });
  ipcMain.handle(CHANNELS.DETACH, async () => browserController.detach());
  ipcMain.handle(CHANNELS.DESTROY, async () => browserController.destroy());
  ipcMain.handle(CHANNELS.SET_BOUNDS, async (_, payload: unknown) => {
    const bounds = validBounds(payload);
    if (!bounds) return { success: false, error: "Invalid bounds" };
    return browserController.setBounds(bounds);
  });
  ipcMain.handle(CHANNELS.SET_VISIBLE, async (_, visible: unknown) => {
    return browserController.setVisible(Boolean(visible));
  });
  ipcMain.handle(CHANNELS.NAVIGATE, async (_, url: unknown) => {
    if (typeof url !== "string") return { success: false, error: "url must be a string" };
    return browserController.navigate(url);
  });
  ipcMain.handle(CHANNELS.BACK, async () => browserController.goBack());
  ipcMain.handle(CHANNELS.FORWARD, async () => browserController.goForward());
  ipcMain.handle(CHANNELS.RELOAD, async () => browserController.reload());
  ipcMain.handle(CHANNELS.STOP, async () => browserController.stop());
  ipcMain.handle(CHANNELS.SET_SELECT_MODE, async (_, enabled: unknown) => {
    return browserController.setSelectMode(Boolean(enabled));
  });
  ipcMain.handle(CHANNELS.GET_NAV_STATE, async () => browserController.getNavState());
  ipcMain.handle(CHANNELS.DELETE_CAPTURE, async (_, captureName: unknown) => {
    if (typeof captureName !== "string") {
      return { success: false, error: "captureName must be a string" };
    }
    return browserController.deleteCapture(captureName);
  });
}

export function unregisterBrowserIpc(): void {
  Object.values(CHANNELS).forEach((ch) => ipcMain.removeHandler(ch));
}
