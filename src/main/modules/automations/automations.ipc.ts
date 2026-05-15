import { ipcMain } from "electron";
import { automationsService } from "./automations.service";
import type { CreateAutomationInput, UpdateAutomationInput } from "./automations.dto";

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerAutomationsIpc() {
  ipcMain.handle("automations:getAll", () =>
    automationsService.getAll(),
  );

  ipcMain.handle("automations:getById", (_, id: string) =>
    automationsService.getById(id),
  );

  ipcMain.handle("automations:create", (_, accountId: string, input: CreateAutomationInput) =>
    automationsService.create(accountId, input),
  );

  ipcMain.handle("automations:update", (_, id: string, input: UpdateAutomationInput) =>
    automationsService.update(id, input),
  );

  ipcMain.handle("automations:delete", (_, id: string) =>
    automationsService.delete(id),
  );

  ipcMain.handle("automations:execute", (_, id: string) =>
    automationsService.executeAutomation(id),
  );

  ipcMain.handle("automations:getRunHistory", (_, automationId: string, limit?: number) =>
    automationsService.getRunHistory(automationId, limit),
  );

  ipcMain.handle("automations:getAvailableActions", () =>
    automationsService.getAvailableActions(),
  );
}

export function unregisterAutomationsIpc() {
  ipcMain.removeHandler("automations:getAll");
  ipcMain.removeHandler("automations:getById");
  ipcMain.removeHandler("automations:create");
  ipcMain.removeHandler("automations:update");
  ipcMain.removeHandler("automations:delete");
  ipcMain.removeHandler("automations:execute");
  ipcMain.removeHandler("automations:getRunHistory");
  ipcMain.removeHandler("automations:getAvailableActions");
}
