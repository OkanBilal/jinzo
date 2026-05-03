import { pulseRepo } from "./pulse.repo";
import { validateCreate, validateUpdate } from "./pulse.validation";
import { runsService } from "../runs/runs.service";
import { appSettingsRepo } from "../appSettings/appSettings.repo";
import { SETTINGS_ID } from "../appSettings/appSettings.constants";
import type {
  CreatePulseInput,
  Pulse,
  PulseFrequency,
  ServiceResponse,
  UpdatePulseInput,
} from "./pulse.dto";

// Pulse forces these provider-specific permission/sandbox/mode values per user spec.
function buildConfigSnapshot(
  providerId: string,
  pulse: Pick<Pulse, "thinkingMode" | "effortLevel">,
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};

  switch (providerId) {
    case "claude_code":
      snapshot.permissionMode = "auto";
      snapshot.thinkingMode = pulse.thinkingMode;
      if (pulse.effortLevel) snapshot.effortLevel = pulse.effortLevel;
      break;
    case "codex":
      snapshot.sandboxMode = "workspace-write";
      if (pulse.effortLevel) snapshot.modelReasoningEffort = pulse.effortLevel;
      break;
    case "copilot_cli":
      snapshot.permissionMode = "allow";
      if (pulse.effortLevel) snapshot.modelReasoningEffort = pulse.effortLevel;
      break;
    case "cursor":
      snapshot.mode = "agent";
      break;
  }

  return snapshot;
}

// ─────────────────────────────────────────────────────────────
// Pure scheduling math
// ─────────────────────────────────────────────────────────────

type ScheduleSpec = {
  frequency: PulseFrequency;
  dayOfWeek?: number | null;
  hour: number;
  minute: number;
};

/**
 * Returns the next firing time strictly after `from` for the given schedule.
 * Uses local time (the device timezone). `timezone` is captured for display.
 */
export function computeNextRunAt(spec: ScheduleSpec, from: Date): Date {
  const next = new Date(from);
  next.setSeconds(0, 0);

  switch (spec.frequency) {
    case "hourly": {
      next.setMinutes(spec.minute);
      if (next <= from) next.setHours(next.getHours() + 1);
      return next;
    }
    case "daily": {
      next.setHours(spec.hour, spec.minute, 0, 0);
      if (next <= from) next.setDate(next.getDate() + 1);
      return next;
    }
    case "weekdays": {
      next.setHours(spec.hour, spec.minute, 0, 0);
      if (next <= from) next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    case "weekly": {
      const target = spec.dayOfWeek ?? 1; // default Monday
      next.setHours(spec.hour, spec.minute, 0, 0);
      const diff = (target - next.getDay() + 7) % 7;
      if (diff === 0 && next <= from) {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + diff);
      }
      return next;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// In-memory single-timer scheduler
// ─────────────────────────────────────────────────────────────

let nextTimer: NodeJS.Timeout | null = null;
let started = false;

function clearNextTimer() {
  if (nextTimer) {
    clearTimeout(nextTimer);
    nextTimer = null;
  }
}

function scheduleNext() {
  clearNextTimer();
  const next = pulseRepo.findNextScheduled();
  if (!next || !next.nextRunAt) return;

  const delay = Math.max(0, new Date(next.nextRunAt).getTime() - Date.now());
  nextTimer = setTimeout(() => {
    pulseService.tick().catch((err) => console.error("[Pulse] tick failed:", err));
  }, delay);
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export const pulseService = {
  start(): void {
    if (started) return;
    started = true;

    // Catch-up: any active pulse with nextRunAt in the past — fire once,
    // then re-schedule normally.
    const due = pulseRepo.findDueActive(new Date());
    if (due.length > 0) {
      console.log(`[Pulse] catching up ${due.length} missed pulse(s)`);
    }
    for (const pulse of due) {
      this.executePulse(pulse.id).catch((err) =>
        console.error(`[Pulse] catch-up failed for ${pulse.id}:`, err),
      );
    }

    scheduleNext();
  },

  stop(): void {
    clearNextTimer();
    started = false;
  },

  // ── CRUD ──

  getAll(): ServiceResponse<Pulse[]> {
    try {
      return { success: true, data: pulseRepo.findAll() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  getById(id: string): ServiceResponse<Pulse | null> {
    try {
      return { success: true, data: pulseRepo.findById(id) ?? null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  create(accountId: string, input: CreatePulseInput): ServiceResponse<Pulse> {
    try {
      const validationError = validateCreate(input);
      if (validationError) return { success: false, error: validationError };

      const nextRunAt = computeNextRunAt(input, new Date());
      const pulse = pulseRepo.create(accountId, input, nextRunAt);
      scheduleNext();
      return { success: true, data: pulse };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  update(id: string, input: UpdatePulseInput): ServiceResponse<Pulse | null> {
    try {
      const validationError = validateUpdate(input);
      if (validationError) return { success: false, error: validationError };

      const existing = pulseRepo.findById(id);
      if (!existing) return { success: false, error: "Pulse not found" };

      // Recompute nextRunAt if any scheduling field changed
      const scheduleChanged =
        input.frequency !== undefined ||
        input.hour !== undefined ||
        input.minute !== undefined ||
        input.dayOfWeek !== undefined;

      const merged = { ...existing, ...input };
      const nextRunAt = scheduleChanged
        ? computeNextRunAt(merged, new Date())
        : undefined;

      const pulse = pulseRepo.update(id, input, nextRunAt);
      scheduleNext();
      return { success: true, data: pulse ?? null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  delete(id: string): ServiceResponse<null> {
    try {
      pulseRepo.delete(id);
      scheduleNext();
      return { success: true, data: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  toggle(id: string, isActive: boolean): ServiceResponse<Pulse | null> {
    return this.update(id, { isActive });
  },

  // ── Execution ──

  async executePulse(id: string): Promise<ServiceResponse<Pulse | null>> {
    const pulse = pulseRepo.findById(id);
    if (!pulse) return { success: false, error: "Pulse not found" };

    const now = new Date();
    const nextRunAt = computeNextRunAt(pulse, now);

    // Claim the pulse synchronously BEFORE awaiting anything so that a
    // concurrent scheduleNext()/tick() pass cannot see it as still due
    // and fire a duplicate run. (See: catch-up race in start().)
    pulseRepo.claimNextRun(id, nextRunAt);

    try {
      const settings = await appSettingsRepo.findById(SETTINGS_ID);
      const configSnapshot = buildConfigSnapshot(pulse.providerId, pulse);

      const result = await runsService.executeRun({
        accountId: pulse.accountId,
        workspaceId: pulse.workspaceId,
        spaceId: settings?.activeSpaceId ?? undefined,
        providerId: pulse.providerId,
        model: pulse.model,
        goal: pulse.prompt,
        configSnapshot,
      });

      if (!result.success) {
        pulseRepo.markRun(id, { lastRunAt: now, nextRunAt, lastError: result.error });
        scheduleNext();
        return { success: false, error: result.error };
      }

      pulseRepo.markRun(id, {
        lastRunAt: now,
        nextRunAt,
        lastRunId: result.data.runId,
        lastError: null,
      });
      scheduleNext();
      return { success: true, data: pulseRepo.findById(id) ?? null };
    } catch (err: any) {
      const message = err?.message ?? String(err);
      pulseRepo.markRun(id, { lastRunAt: now, nextRunAt, lastError: message });
      scheduleNext();
      return { success: false, error: message };
    }
  },

  async runNow(id: string): Promise<ServiceResponse<Pulse | null>> {
    return this.executePulse(id);
  },

  async tick(): Promise<void> {
    const due = pulseRepo.findDueActive(new Date());
    for (const pulse of due) {
      await this.executePulse(pulse.id);
    }
    scheduleNext();
  },
};
