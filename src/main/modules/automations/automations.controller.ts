import { automationsService } from "./automations.service";
import type {
  Automation,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
  ServiceResponse,
} from "./automations.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const automationsController = {
  getAll(): ServiceResponse<Automation[]> {
    return automationsService.getAll();
  },

  getById(id: string): ServiceResponse<Automation | null> {
    return automationsService.getById(id);
  },

  create(accountId: string, input: CreateAutomationInput): ServiceResponse<Automation> {
    return automationsService.create(accountId, input);
  },

  update(id: string, input: UpdateAutomationInput): ServiceResponse<Automation | null> {
    return automationsService.update(id, input);
  },

  delete(id: string): ServiceResponse<null> {
    return automationsService.delete(id);
  },

  async execute(id: string): Promise<ServiceResponse<AutomationRun | null>> {
    return automationsService.executeAutomation(id);
  },

  getRunHistory(automationId: string, limit?: number): ServiceResponse<AutomationRun[]> {
    return automationsService.getRunHistory(automationId, limit);
  },

  getAvailableActions(): ServiceResponse<string[]> {
    return { success: true, data: automationsService.getAvailableActions() };
  },
};
