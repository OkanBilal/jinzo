import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { automationsRepo } from "./automations.repo";
import { syncService } from "../sync/sync.service";
import type {
  Automation,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
  ServiceResponse,
} from "./automations.dto";

// ─────────────────────────────────────────────────────────────
// Action Registry — maps action strings to executable functions
// ─────────────────────────────────────────────────────────────
type ActionHandler = (config?: string | null) => Promise<string | null>;

const actionHandlers: Record<string, ActionHandler> = {
  "sync:all": async () => {
    const result = await syncService.runEntitySync();
    return JSON.stringify(result.success ? result.data : { error: result.error });
  },

  "sync:github": async () => {
    const result = await syncService.runEntitySync("github");
    return JSON.stringify(result.success ? result.data : { error: result.error });
  },

  "sync:gitlab": async () => {
    const result = await syncService.runEntitySync("gitlab");
    return JSON.stringify(result.success ? result.data : { error: result.error });
  },

  "sync:linear": async () => {
    const result = await syncService.runEntitySync("linear");
    return JSON.stringify(result.success ? result.data : { error: result.error });
  },

  "sync:jira": async () => {
    const result = await syncService.runEntitySync("jira");
    return JSON.stringify(result.success ? result.data : { error: result.error });
  },

  "sync:asana": async () => {
    const result = await syncService.runEntitySync("asana");
    return JSON.stringify(result.success ? result.data : { error: result.error });
  },

  "sync:trello": async () => {
    const result = await syncService.runEntitySync("trello");
    return JSON.stringify(result.success ? result.data : { error: result.error });
  },

  "sync:notion": async () => {
    const result = await syncService.runEntitySync("notion");
    return JSON.stringify(result.success ? result.data : { error: result.error });
  },

  "sync:sentry": async () => {
    const result = await syncService.runEntitySync("sentry");
    return JSON.stringify(result.success ? result.data : { error: result.error });
  },
};

// ─────────────────────────────────────────────────────────────
// Scheduler — in-memory timer manager
// ─────────────────────────────────────────────────────────────
const timers = new Map<string, NodeJS.Timeout>();

function scheduleNext(automation: Automation) {
  // Clear existing timer
  const existing = timers.get(automation.id);
  if (existing) clearTimeout(existing);

  if (!automation.isActive) return;

  const now = Date.now();
  const nextRun = automation.nextRunAt
    ? new Date(automation.nextRunAt).getTime()
    : now + automation.intervalMinutes * 60_000;

  const delay = Math.max(0, nextRun - now);

  const timer = setTimeout(() => {
    automationsService.executeAutomation(automation.id).catch((err) => {
      console.error(`Automation ${automation.id} failed:`, err);
    });
  }, delay);

  timers.set(automation.id, timer);
}

function cancelTimer(automationId: string) {
  const timer = timers.get(automationId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(automationId);
  }
}

// ─────────────────────────────────────────────────────────────
// Service — Business logic
// ─────────────────────────────────────────────────────────────
export const automationsService = {
  // ── Lifecycle ──

  start() {
    const active = automationsRepo.findActive();
    console.log(`Automations: scheduling ${active.length} active automation(s)`);
    for (const a of active) {
      scheduleNext(a);
    }
  },

  stop() {
    for (const [id] of timers) {
      cancelTimer(id);
    }
    timers.clear();
  },

  // ── CRUD ──

  getAll(): ServiceResponse<Automation[]> {
    try {
      return ok(automationsRepo.findAll());
    } catch (err: any) {
      return fail(err.message);
    }
  },

  getById(id: string): ServiceResponse<Automation | null> {
    try {
      return ok(automationsRepo.findById(id) ?? null);
    } catch (err: any) {
      return fail(err.message);
    }
  },

  create(accountId: string, input: CreateAutomationInput): ServiceResponse<Automation> {
    try {
      if (!actionHandlers[input.action]) {
        return fail(`Unknown action: ${input.action}`);
      }
      if (input.intervalMinutes < 1) {
        return fail("Interval must be at least 1 minute");
      }

      const automation = automationsRepo.create(accountId, input);
      scheduleNext(automation);

      return ok(automation);
    } catch (err: any) {
      return fail(err.message);
    }
  },

  update(id: string, input: UpdateAutomationInput): ServiceResponse<Automation | null> {
    try {
      if (input.action && !actionHandlers[input.action]) {
        return fail(`Unknown action: ${input.action}`);
      }
      if (input.intervalMinutes !== undefined && input.intervalMinutes < 1) {
        return fail("Interval must be at least 1 minute");
      }

      const automation = automationsRepo.update(id, input);
      if (!automation) {
        return fail("Automation not found");
      }

      // Reschedule or cancel
      if (automation.isActive) {
        scheduleNext(automation);
      } else {
        cancelTimer(id);
      }

      return ok(automation);
    } catch (err: any) {
      return fail(err.message);
    }
  },

  delete(id: string): ServiceResponse<null> {
    try {
      cancelTimer(id);
      automationsRepo.delete(id);
      return ok(null);
    } catch (err: any) {
      return fail(err.message);
    }
  },

  // ── Execution ──

  async executeAutomation(id: string): Promise<ServiceResponse<AutomationRun | null>> {
    const automation = automationsRepo.findById(id);
    if (!automation) {
      return fail("Automation not found");
    }

    const handler = actionHandlers[automation.action];
    if (!handler) {
      return fail(`No handler for action: ${automation.action}`);
    }

    const runId = automationsRepo.createRun(id);

    try {
      const result = await handler(automation.config);
      automationsRepo.completeRun(runId, "success", result ?? undefined);
      automationsRepo.markRunCompleted(id);

      // Schedule next run
      const updated = automationsRepo.findById(id);
      if (updated) scheduleNext(updated);

      const runs = automationsRepo.getRunsByAutomation(id, 1);
      return ok(runs[0] ?? null);
    } catch (err: any) {
      const errorMsg = err.message || "Unknown error";
      automationsRepo.completeRun(runId, "error", undefined, errorMsg);
      automationsRepo.markRunCompleted(id, errorMsg);

      // Schedule next run even on error
      const updated = automationsRepo.findById(id);
      if (updated) scheduleNext(updated);

      const runs = automationsRepo.getRunsByAutomation(id, 1);
      return ok(runs[0] ?? null);
    }
  },

  // ── Run History ──

  getRunHistory(automationId: string, limit = 20): ServiceResponse<AutomationRun[]> {
    try {
      return ok(automationsRepo.getRunsByAutomation(automationId, limit));
    } catch (err: any) {
      return fail(err.message);
    }
  },

  // ── Helpers ──

  getAvailableActions(): string[] {
    return Object.keys(actionHandlers);
  },

  registerAction(action: string, handler: ActionHandler) {
    actionHandlers[action] = handler;
  },
};
