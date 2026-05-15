// IPC
export { registerAutomationsIpc, unregisterAutomationsIpc } from "./automations.ipc";

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
