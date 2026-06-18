import { ipcMain } from "../../ipc-kit/ipc-main";
import { pulseService } from "./pulse.service";
import type { CreatePulseInput, UpdatePulseInput } from "./pulse.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

export function registerPulseIpc() {
  ipcMain.handle(CHANNELS.pulse.getAll, () => pulseService.getAll());

  ipcMain.handle(CHANNELS.pulse.getById, (_, id: string) => pulseService.getById(id));

  ipcMain.handle(
    CHANNELS.pulse.create,
    (_, accountId: string, input: CreatePulseInput) =>
      pulseService.create(accountId, input),
  );

  ipcMain.handle(
    CHANNELS.pulse.update,
    (_, id: string, input: UpdatePulseInput) => pulseService.update(id, input),
  );

  ipcMain.handle(CHANNELS.pulse.delete, (_, id: string) => pulseService.delete(id));

  ipcMain.handle(CHANNELS.pulse.toggle, (_, id: string, isActive: boolean) =>
    pulseService.toggle(id, isActive),
  );

  ipcMain.handle(CHANNELS.pulse.runNow, (_, id: string) => pulseService.runNow(id));
}

export function unregisterPulseIpc() {
  ipcMain.removeHandler(CHANNELS.pulse.getAll);
  ipcMain.removeHandler(CHANNELS.pulse.getById);
  ipcMain.removeHandler(CHANNELS.pulse.create);
  ipcMain.removeHandler(CHANNELS.pulse.update);
  ipcMain.removeHandler(CHANNELS.pulse.delete);
  ipcMain.removeHandler(CHANNELS.pulse.toggle);
  ipcMain.removeHandler(CHANNELS.pulse.runNow);
}
