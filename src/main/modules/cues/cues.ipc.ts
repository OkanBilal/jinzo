import { CHANNELS } from "../../../shared/ipc-kit/channels";
import { handle } from "../../ipc-kit/handle";
import { ipcMain } from "../../ipc-kit/ipc-main";
import type { CreateCueInput, UpdateCueInput } from "./cues.dto";
import { cuesService } from "./cues.service";

export function registerCuesIpc(): void {
  ipcMain.handle(
    CHANNELS.cues.listByProject,
    handle((projectId: string) => cuesService.listByProject(projectId)),
  );
  ipcMain.handle(CHANNELS.cues.getById, handle((id: string) => cuesService.getById(id)));
  ipcMain.handle(
    CHANNELS.cues.create,
    handle((accountId: string, input: CreateCueInput) => cuesService.create(accountId, input)),
  );
  ipcMain.handle(
    CHANNELS.cues.update,
    handle((id: string, input: UpdateCueInput) => cuesService.update(id, input)),
  );
  ipcMain.handle(CHANNELS.cues.delete, handle((id: string) => cuesService.delete(id)));
}

export function unregisterCuesIpc(): void {
  [
    CHANNELS.cues.listByProject,
    CHANNELS.cues.getById,
    CHANNELS.cues.create,
    CHANNELS.cues.update,
    CHANNELS.cues.delete,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
