import { ipcMain } from "electron";
import { imageProxyService } from "./imageProxy.service";

export function registerImageProxyIpc() {
  ipcMain.handle("imageProxy:sign", (_, rawPath: string) => {
    const url = imageProxyService.signLocalImageUrl(rawPath);
    if (!url) {
      return { success: false, error: "Invalid path" };
    }
    return { success: true, data: url };
  });
}

export function unregisterImageProxyIpc() {
  ipcMain.removeHandler("imageProxy:sign");
}
