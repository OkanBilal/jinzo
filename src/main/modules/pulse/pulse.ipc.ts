import { ipcMain } from "electron";
import { pulseService } from "./pulse.service";
import type { CreatePulseInput, UpdatePulseInput } from "./pulse.dto";

export function registerPulseIpc() {
  ipcMain.handle("pulse:getAll", () => pulseService.getAll());

  ipcMain.handle("pulse:getById", (_, id: string) => pulseService.getById(id));

  ipcMain.handle(
    "pulse:create",
    (_, accountId: string, input: CreatePulseInput) =>
      pulseService.create(accountId, input),
  );

  ipcMain.handle(
    "pulse:update",
    (_, id: string, input: UpdatePulseInput) => pulseService.update(id, input),
  );

  ipcMain.handle("pulse:delete", (_, id: string) => pulseService.delete(id));

  ipcMain.handle("pulse:toggle", (_, id: string, isActive: boolean) =>
    pulseService.toggle(id, isActive),
  );

  ipcMain.handle("pulse:runNow", (_, id: string) => pulseService.runNow(id));
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
