import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { ipcMain } from "electron";
import { imageProxyService } from "./imageProxy.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

export function registerImageProxyIpc() {
  ipcMain.handle(CHANNELS.imageProxy.sign, (_, rawPath: string) => {
    const url = imageProxyService.signLocalImageUrl(rawPath);
    if (!url) {
      return fail("Invalid path");
    }
    return ok(url);
  });
}

export function unregisterImageProxyIpc() {
  ipcMain.removeHandler(CHANNELS.imageProxy.sign);
}
