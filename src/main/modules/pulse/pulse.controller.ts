import { pulseService } from "./pulse.service";
import type {
  CreatePulseInput,
  Pulse,
  ServiceResponse,
  UpdatePulseInput,
} from "./pulse.dto";

export const pulseController = {
  getAll(): ServiceResponse<Pulse[]> {
    return pulseService.getAll();
  },

  getById(id: string): ServiceResponse<Pulse | null> {
    return pulseService.getById(id);
  },

  create(accountId: string, input: CreatePulseInput): ServiceResponse<Pulse> {
    return pulseService.create(accountId, input);
  },

  update(id: string, input: UpdatePulseInput): ServiceResponse<Pulse | null> {
    return pulseService.update(id, input);
  },

  delete(id: string): ServiceResponse<null> {
    return pulseService.delete(id);
  },

  toggle(id: string, isActive: boolean): ServiceResponse<Pulse | null> {
    return pulseService.toggle(id, isActive);
  },

  async runNow(id: string): Promise<ServiceResponse<Pulse | null>> {
    return pulseService.runNow(id);
  },
};
