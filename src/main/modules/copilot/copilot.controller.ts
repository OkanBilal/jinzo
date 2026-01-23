import { copilotService } from "./copilot.service";

// ─────────────────────────────────────────────────────────────
// Copilot Controller
// ─────────────────────────────────────────────────────────────
export const copilotController = {
  async chat(prompt: string) {
    return copilotService.chat(prompt);
  },
};
