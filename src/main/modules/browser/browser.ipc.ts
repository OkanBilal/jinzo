import { fail } from "../../../shared/ipc-kit/service-response";
import { ipcMain } from "electron";
import { browserService } from "./browser.service";
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
    if (!bounds) return fail("Invalid bounds");
    return browserService.attach(bounds);
  });
  ipcMain.handle(CHANNELS.DETACH, async () => browserService.detach());
  ipcMain.handle(CHANNELS.DESTROY, async () => browserService.destroy());
  ipcMain.handle(CHANNELS.SET_BOUNDS, async (_, payload: unknown) => {
    const bounds = validBounds(payload);
    if (!bounds) return fail("Invalid bounds");
    return browserService.setBounds(bounds);
  });
  ipcMain.handle(CHANNELS.SET_VISIBLE, async (_, visible: unknown) => {
    return browserService.setVisible(Boolean(visible));
  });
  ipcMain.handle(CHANNELS.NAVIGATE, async (_, url: unknown) => {
    if (typeof url !== "string") return fail("url must be a string");
    return browserService.navigate(url);
  });
  ipcMain.handle(CHANNELS.BACK, async () => browserService.goBack());
  ipcMain.handle(CHANNELS.FORWARD, async () => browserService.goForward());
  ipcMain.handle(CHANNELS.RELOAD, async () => browserService.reload());
  ipcMain.handle(CHANNELS.STOP, async () => browserService.stop());
  ipcMain.handle(CHANNELS.SET_SELECT_MODE, async (_, enabled: unknown) => {
    return browserService.setSelectMode(Boolean(enabled));
  });
  ipcMain.handle(CHANNELS.GET_NAV_STATE, async () => browserService.getNavState());
  ipcMain.handle(CHANNELS.DELETE_CAPTURE, async (_, captureName: unknown) => {
    if (typeof captureName !== "string") {
      return fail("captureName must be a string");
    }
    return browserService.deleteCapture(captureName);
  });
}

export function unregisterBrowserIpc(): void {
  Object.values(CHANNELS).forEach((ch) => ipcMain.removeHandler(ch));
}
