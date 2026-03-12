import { ipcMain } from "electron";
import { automationsController } from "./automations.controller";
import type { CreateAutomationInput, UpdateAutomationInput } from "./automations.dto";

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerAutomationsIpc() {
  ipcMain.handle("automations:getAll", () =>
    automationsController.getAll(),
  );

  ipcMain.handle("automations:getById", (_, id: string) =>
    automationsController.getById(id),
  );

  ipcMain.handle("automations:create", (_, accountId: string, input: CreateAutomationInput) =>
    automationsController.create(accountId, input),
  );

  ipcMain.handle("automations:update", (_, id: string, input: UpdateAutomationInput) =>
    automationsController.update(id, input),
  );

  ipcMain.handle("automations:delete", (_, id: string) =>
    automationsController.delete(id),
  );

  ipcMain.handle("automations:execute", (_, id: string) =>
    automationsController.execute(id),
  );

  ipcMain.handle("automations:getRunHistory", (_, automationId: string, limit?: number) =>
    automationsController.getRunHistory(automationId, limit),
  );

  ipcMain.handle("automations:getAvailableActions", () =>
    automationsController.getAvailableActions(),
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
