import type { automations, automationRuns } from "../../db/schema";

// ─────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────

export type Automation = typeof automations.$inferSelect;
export type AutomationRun = typeof automationRuns.$inferSelect;

export type CreateAutomationInput = {
  name: string;
  kind: Automation["kind"];
  action: string;
  intervalMinutes: number;
  isActive?: boolean;
  config?: string | null;
};

export type UpdateAutomationInput = Partial<
  Pick<Automation, "name" | "kind" | "action" | "intervalMinutes" | "isActive" | "config">
>;

export type ServiceResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
