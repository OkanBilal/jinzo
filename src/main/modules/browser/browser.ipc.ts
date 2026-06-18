import { fail } from "../../../shared/ipc-kit/service-response";
import { ipcMain } from "../../ipc-kit/ipc-main";
import { browserService } from "./browser.service";
import type { BrowserBounds } from "./browser.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

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
  ipcMain.handle(CHANNELS.browser.attach, async (_, payload: unknown) => {
    const bounds = validBounds(payload);
    if (!bounds) return fail("Invalid bounds");
    return browserService.attach(bounds);
  });
  ipcMain.handle(CHANNELS.browser.detach, async () => browserService.detach());
  ipcMain.handle(CHANNELS.browser.destroy, async () => browserService.destroy());
  ipcMain.handle(CHANNELS.browser.setBounds, async (_, payload: unknown) => {
    const bounds = validBounds(payload);
    if (!bounds) return fail("Invalid bounds");
    return browserService.setBounds(bounds);
  });
  ipcMain.handle(CHANNELS.browser.setVisible, async (_, visible: unknown) => {
    return browserService.setVisible(Boolean(visible));
  });
  ipcMain.handle(CHANNELS.browser.navigate, async (_, url: unknown) => {
    if (typeof url !== "string") return fail("url must be a string");
    return browserService.navigate(url);
  });
  ipcMain.handle(CHANNELS.browser.back, async () => browserService.goBack());
  ipcMain.handle(CHANNELS.browser.forward, async () => browserService.goForward());
  ipcMain.handle(CHANNELS.browser.reload, async () => browserService.reload());
  ipcMain.handle(CHANNELS.browser.stop, async () => browserService.stop());
  ipcMain.handle(CHANNELS.browser.setSelectMode, async (_, enabled: unknown) => {
    return browserService.setSelectMode(Boolean(enabled));
  });
  ipcMain.handle(CHANNELS.browser.getNavState, async () => browserService.getNavState());
  ipcMain.handle(CHANNELS.browser.deleteCapture, async (_, captureName: unknown) => {
    if (typeof captureName !== "string") {
      return fail("captureName must be a string");
    }
    return browserService.deleteCapture(captureName);
  });
}

export function unregisterBrowserIpc(): void {
  [
    CHANNELS.browser.attach,
    CHANNELS.browser.detach,
    CHANNELS.browser.destroy,
    CHANNELS.browser.setBounds,
    CHANNELS.browser.setVisible,
    CHANNELS.browser.navigate,
    CHANNELS.browser.back,
    CHANNELS.browser.forward,
    CHANNELS.browser.reload,
    CHANNELS.browser.stop,
    CHANNELS.browser.setSelectMode,
    CHANNELS.browser.getNavState,
    CHANNELS.browser.deleteCapture,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
