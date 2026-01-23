import { CopilotClient } from "@github/copilot-sdk";
import type { ServiceResponse } from "./copilot.dto";

// ─────────────────────────────────────────────────────────────
// Copilot Client Instance
// ─────────────────────────────────────────────────────────────
let client: CopilotClient | null = null;

// ─────────────────────────────────────────────────────────────
// Copilot Service
// ─────────────────────────────────────────────────────────────
export const copilotService = {
  async chat(prompt: string): Promise<ServiceResponse<string>> {
    try {
      if (!client) {
        client = new CopilotClient();
      }
      const session = await client.createSession({ model: "gpt-4.1" });
      const response = await session.sendAndWait({ prompt });
      return { success: true, data: response?.data.content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
