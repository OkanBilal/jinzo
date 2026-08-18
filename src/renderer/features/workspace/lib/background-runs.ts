/**
 * Which live runs count as *background*, and how a card labels one.
 *
 * React-free on purpose: "is this run off-screen right now" is a rule about
 * space, route, and workspace — three values the dock already has — and it is
 * the one part of this feature worth testing directly.
 */

import type { ActiveRun } from "@/lib/redux/api";
import type { ModeId } from "../../../../shared/modes";

export interface SelectBackgroundRunsInput {
  /** Every run with a live session, from `runs:listActive`. */
  activeRuns: ActiveRun[];
  /**
   * The workspace `/code/:workspaceId` is rendering right now, or null on any
   * other route. Null means nothing is on screen, so every live run is
   * background — which is the point on `/pulse`, `/tasks`, or Settings.
   */
  visibleWorkspaceId: string | null;
  /** The provider that page is driving — the active space's `providerId`. */
  visibleProviderId: string | null;
  /** Mode currently rendered by the active space. */
  visibleMode: ModeId | null;
  /** Workspace-less run route currently rendered, if any. */
  visibleRunId: string | null;
}

/**
 * A run is on screen when the workspace page is showing its workspace *and*
 * driving its provider — which is exactly the pair that puts its tab in the tab
 * bar, since the page loads a workspace's runs filtered by provider id
 * (`use-workspace-runs.loadWorkspaceRuns`).
 *
 * Provider, not space: two spaces can drive the same agent, and a run's tab is
 * present under either of them. Matching on space would also have meant
 * matching on a field that runs did not carry until recently, so every run —
 * including the one the user was watching — read as backgrounded.
 */
export function selectBackgroundRuns({
  activeRuns,
  visibleWorkspaceId,
  visibleProviderId,
  visibleMode,
  visibleRunId,
}: SelectBackgroundRunsInput): ActiveRun[] {
  return activeRuns.filter((run) => {
    const isDirectlyOnScreen =
      run.id === visibleRunId &&
      run.providerId === visibleProviderId &&
      run.mode === visibleMode;
    const isWorkspaceRunOnScreen =
      !!visibleWorkspaceId &&
      run.workspaceId === visibleWorkspaceId &&
      run.providerId === visibleProviderId &&
      run.mode === visibleMode;
    return !isDirectlyOnScreen && !isWorkspaceRunOnScreen;
  });
}

/** A run that has stopped working — the dock keeps it briefly, then drops it. */
export function isRunFinished(run: Pick<ActiveRun, "status">): boolean {
  return run.status !== "queued" && run.status !== "running";
}

/** Outcome word for a finished card's meta line. */
export function runOutcomeLabel(run: Pick<ActiveRun, "status">): string {
  switch (run.status) {
    case "succeeded":
      return "Done";
    case "failed":
      return "Failed";
    case "canceled":
      return "Stopped";
    default:
      return "";
  }
}

/**
 * The dock's list: everything still working, plus the runs that just finished
 * and are being held for a moment. Held copies are dropped the instant the
 * backend reports the same run as live again (a resume), so the two lists can
 * never both claim one run.
 */
export function mergeLingeringRuns(
  activeRuns: ActiveRun[],
  lingering: ActiveRun[],
): ActiveRun[] {
  const activeIds = new Set(activeRuns.map((run) => run.id));
  const held = lingering.filter((run) => !activeIds.has(run.id));
  if (held.length === 0) return activeRuns;
  // Same ordering the repo hands back: oldest first, so a card keeps its place
  // in the deck when it flips from working to finished.
  return [...activeRuns, ...held].sort((a, b) => a.createdAt - b.createdAt);
}

export interface SpaceChoice {
  id: string;
  providerId: string;
  mode: ModeId;
}

/**
 * Which space to switch to before opening a run, or null when no space can
 * drive it (its provider's spaces are all archived).
 *
 * The run's own space when it has one — runs started before that field was
 * filled have none, and a run must still be reachable. Failing that, any space
 * driving the run's provider, preferring the active one so a jump inside the
 * same agent doesn't move the user out of the space they are working in.
 */
export function resolveRunSpaceId(
  run: Pick<ActiveRun, "spaceId" | "providerId" | "mode">,
  spaces: SpaceChoice[],
  activeSpaceId: string | null,
): string | null {
  if (
    run.spaceId &&
    spaces.some(
      (space) =>
        space.id === run.spaceId &&
        space.providerId === run.providerId &&
        space.mode === run.mode,
    )
  ) {
    return run.spaceId;
  }
  const active = spaces.find((space) => space.id === activeSpaceId);
  if (active?.providerId === run.providerId && active.mode === run.mode) {
    return active.id;
  }
  return (
    spaces.find(
      (space) => space.providerId === run.providerId && space.mode === run.mode,
    )?.id ?? null
  );
}

/** What the card prints as the run's name — title, else the goal's first line. */
export function backgroundRunLabel(run: ActiveRun): string {
  const title = run.title?.trim();
  if (title) return title;
  const goalLine = run.goal?.split("\n").find((line) => line.trim())?.trim();
  if (goalLine) return goalLine;
  return "Untitled run";
}

/**
 * Run timestamps are declared as numbers but arrive as `Date`: Drizzle maps the
 * column to one, and both transports preserve it (structured clone locally, the
 * `$date` tag over WebSocket). Normalize rather than trust either.
 */
function toEpochMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Elapsed time in the dock's compact form: `12s`, `4m 08s`, `1h 07m`.
 * Counts from `startedAt` — a queued run has none, so it falls back to when the
 * row was created — and stops at `endedAt`, so a finished card held in the dock
 * shows how long the run took rather than a clock that keeps running.
 */
export function formatRunElapsed(run: ActiveRun, nowMs: number): string {
  const since = toEpochMs(run.startedAt) ?? toEpochMs(run.createdAt) ?? nowMs;
  const until = toEpochMs(run.endedAt) ?? nowMs;
  const totalSeconds = Math.max(0, Math.floor((until - since) / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/**
 * Last meaningful line of a streamed chunk. Adapter streams are cumulative, so
 * the tail is "what it is doing now" — the dock's equivalent of a track title.
 */
export function lastActivityLine(content: string): string | null {
  const lines = content.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line) return line.length > 120 ? `${line.slice(0, 120)}…` : line;
  }
  return null;
}
