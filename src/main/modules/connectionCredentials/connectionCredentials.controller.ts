import { connectionCredentialsService } from "./connectionCredentials.service";
import type { SaveCredentialsPayload } from "./connectionCredentials.dto";

// ─────────────────────────────────────────────────────────────
// Connection Credentials Controller
// ─────────────────────────────────────────────────────────────
export const connectionCredentialsController = {
  async saveCredentials(payload: SaveCredentialsPayload) {
    return connectionCredentialsService.saveCredentials(payload);
  },

  async checkCredentials(provider: string) {
    return connectionCredentialsService.checkCredentials(provider);
  },
};
