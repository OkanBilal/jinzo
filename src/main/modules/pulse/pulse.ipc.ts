import { ipcMain } from "electron";
import { pulseController } from "./pulse.controller";
import type { CreatePulseInput, UpdatePulseInput } from "./pulse.dto";

export function registerPulseIpc() {
  ipcMain.handle("pulse:getAll", () => pulseController.getAll());

  ipcMain.handle("pulse:getById", (_, id: string) => pulseController.getById(id));

  ipcMain.handle(
    "pulse:create",
    (_, accountId: string, input: CreatePulseInput) =>
      pulseController.create(accountId, input),
  );

  ipcMain.handle(
    "pulse:update",
    (_, id: string, input: UpdatePulseInput) => pulseController.update(id, input),
  );

  ipcMain.handle("pulse:delete", (_, id: string) => pulseController.delete(id));

  ipcMain.handle("pulse:toggle", (_, id: string, isActive: boolean) =>
    pulseController.toggle(id, isActive),
  );

  ipcMain.handle("pulse:runNow", (_, id: string) => pulseController.runNow(id));
}

export function unregisterPulseIpc() {
  ipcMain.removeHandler("pulse:getAll");
  ipcMain.removeHandler("pulse:getById");
  ipcMain.removeHandler("pulse:create");
  ipcMain.removeHandler("pulse:update");
  ipcMain.removeHandler("pulse:delete");
  ipcMain.removeHandler("pulse:toggle");
  ipcMain.removeHandler("pulse:runNow");
}
