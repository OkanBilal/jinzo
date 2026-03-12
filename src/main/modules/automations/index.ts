// IPC
export { registerAutomationsIpc, unregisterAutomationsIpc } from "./automations.ipc";

// Controller
export { automationsController } from "./automations.controller";

// Service
export { automationsService } from "./automations.service";

// Repository
export { automationsRepo } from "./automations.repo";

// DTOs
export type {
  Automation,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
  ServiceResponse,
} from "./automations.dto";
