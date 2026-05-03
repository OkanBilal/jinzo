import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  Bot,
  Brain,
  Clock,
  Codex,
  CopilotStatic,
  Project,
} from "@/components/ui/icons";
import {
  Claude,
  CursorIcon,
  Earth,
} from "@/components/ui/icons/space";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import Select from "@/components/ui/select";
import { useClickOutside } from "@/hooks/use-click-outside";
import { getModelIcon, type ModelIconVariant } from "@/lib/model-icons";
import { useGetWorkspacesQuery } from "@/lib/redux/api/workspacesApi";
import {
  useGetEnabledProvidersQuery,
  useGetProviderModelsQuery,
} from "@/lib/redux/api/providersApi";
import {
  formatSchedule,
  formatTime,
  FREQUENCY_OPTIONS,
  WEEK_DAYS,
} from "../utils/format-schedule";
import type { PulseFrequency } from "@/lib/redux/api/pulseApi";

const SUPPORTED_PROVIDER_IDS = [
  "claude_code",
  "copilot_cli",
  "codex",
  "cursor",
];

const PROVIDER_LABELS: Record<string, string> = {
  claude_code: "Claude",
  copilot_cli: "Copilot",
  codex: "Codex",
  cursor: "Cursor",
};

function ProviderIcon({ id, className }: { id: string; className?: string }) {
  const cls = className ?? "size-4";
  switch (id) {
    case "claude_code":
      return <Claude className={cls} />;
    case "copilot_cli":
      return <CopilotStatic className={cls} />;
    case "codex":
      return <Codex className={cls} />;
    case "cursor":
      return <CursorIcon className={cls} />;
    default:
      return null;
  }
}

const triggerClass =
  "flex items-center gap-1.5 px-2 py-1 rounded-xl text-s transition-all cursor-pointer animate-blur-reveal text-primary-700 dark:text-primary-300 hover:bg-primary-200/30 dark:hover:bg-primary-800";

// 24h × 4 (15-minute) = 96 entries, formatted as "1:15 PM"
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push({ value: `${h}:${m}`, label: formatTime(h, m) });
    }
  }
  return out;
})();

const DAY_OPTIONS: { value: string; label: string }[] = WEEK_DAYS.map((d) => ({
  value: String(d.value),
  label: d.label,
}));


// ── Workspace picker ────────────────────────────────────────────

export function WorkspacePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  const { data: workspaces = [] } = useGetWorkspacesQuery();
  const active = workspaces.filter((w) => !w.isArchived);
  const selected = active.find((w) => w.id === value);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        tooltip="Select workspace"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        <Project className="size-3.5" />
        <span className="truncate ">
          {selected?.name ?? "Select workspace"}
        </span>
        <ArrowUp className="size-3.5 rotate-180 " />
      </Button>
      <DropdownWrapper isOpen={open} minWidth="min-w-44" useFixedBackground>
        {active.length === 0 && (
          <div className="px-3 py-2 text-xs text-primary-500">
            No active workspaces
          </div>
        )}
        <div className="max-h-64 overflow-auto noscrollbar">
          {active.map((w) => (
            <Button
              key={w.id}
              type="button"
              onClick={() => {
                onChange(w.id);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 text-s cursor-pointer transition-colors first:rounded-t-sm! last:rounded-b-sm! ${
                value === w.id
                  ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-700 dark:text-primary-100"
                  : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
              }`}
            >
              <span className="truncate">{w.name}</span>
            </Button>
          ))}
        </div>
      </DropdownWrapper>
    </div>
  );
}

// ── Provider picker ────────────────────────────────────────────

export function ProviderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  const { data: providers = [] } = useGetEnabledProvidersQuery();
  const eligible = providers.filter((p) =>
    SUPPORTED_PROVIDER_IDS.includes(p.id),
  );
  const selected = eligible.find((p) => p.id === value);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        tooltip="Select provider"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        {selected ? (
          <ProviderIcon id={selected.id} className="size-4" />
        ) : (
          <Earth className="size-4" />
        )}
        <span>{selected ? PROVIDER_LABELS[selected.id] ?? selected.displayName : "Provider"}</span>
        <ArrowUp className="size-3.5 rotate-180 " />
      </Button>
      <DropdownWrapper isOpen={open} minWidth="min-w-44" useFixedBackground>
        {eligible.length === 0 && (
          <div className="px-3 py-2 text-xs text-primary-500">
            No enabled providers
          </div>
        )}
        {eligible.map((p) => (
          <Button
            key={p.id}
            type="button"
            onClick={() => {
              onChange(p.id);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-sm cursor-pointer transition-colors first:rounded-t-sm! last:rounded-b-sm! ${
              value === p.id
                ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-700 dark:text-primary-100"
                : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
            }`}
          >
            <ProviderIcon id={p.id} className="size-4 shrink-0" />
            <span>{PROVIDER_LABELS[p.id] ?? p.displayName}</span>
          </Button>
        ))}
      </DropdownWrapper>
    </div>
  );
}

// ── Model picker ────────────────────────────────────────────

export function ModelPicker({
  providerId,
  value,
  onChange,
}: {
  providerId: string;
  value: string;
  onChange: (id: string, supportedEffortLevels?: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  const { data: models = [] } = useGetProviderModelsQuery(providerId, {
    skip: !providerId,
  });
  const selected = models.find((m) => m.id === value);
  const variant: ModelIconVariant | undefined =
    providerId === "claude_code"
      ? "claude"
      : providerId === "copilot_cli"
        ? "copilot"
        : providerId === "codex"
          ? "codex"
          : providerId === "cursor"
            ? "cursor"
            : undefined;

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        tooltip="Select model"
        disabled={!providerId}
        onClick={() => setOpen((v) => !v)}
        className={`${triggerClass} ${!providerId ? "opacity-40 cursor-not-allowed" : ""}`}
      >
        {selected ? (
          getModelIcon(selected.displayName, variant)
        ) : (
          <Bot className="size-4" />
        )}
        <span className="truncate max-w-[140px]">
          {selected?.displayName ?? "Model"}
        </span>
        <ArrowUp className="size-3.5 rotate-180" />
      </Button>
      <DropdownWrapper isOpen={open} minWidth="min-w-56" useFixedBackground>
        {models.length === 0 && (
          <div className="px-3 py-2 text-xs text-primary-500">
            {providerId ? "Loading models…" : "Select a provider first"}
          </div>
        )}
        <div className="max-h-64 overflow-auto noscrollbar">
          {models.map((m) => (
            <Button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id, m.supportedEffortLevels);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-sm cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl ${
                value === m.id
                  ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-700 dark:text-primary-100"
                  : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
              }`}
            >
              {getModelIcon(m.displayName, variant)}
              <span className="truncate">{m.displayName}</span>
            </Button>
          ))}
        </div>
      </DropdownWrapper>
    </div>
  );
}

// ── Schedule picker ────────────────────────────────────────────

export function SchedulePicker({
  frequency,
  hour,
  minute,
  dayOfWeek,
  onChange,
}: {
  frequency: PulseFrequency;
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  onChange: (next: {
    frequency: PulseFrequency;
    hour: number;
    minute: number;
    dayOfWeek: number | null;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);

  const update = (
    patch: Partial<{
      frequency: PulseFrequency;
      hour: number;
      minute: number;
      dayOfWeek: number | null;
    }>,
  ) => {
    const next = {
      frequency,
      hour,
      minute,
      dayOfWeek,
      ...patch,
    };
    if (next.frequency === "weekly" && next.dayOfWeek == null) next.dayOfWeek = 1;
    if (next.frequency !== "weekly") next.dayOfWeek = null;
    // Hourly always fires on the hour (no minute control in the UI).
    if (next.frequency === "hourly") next.minute = 0;
    onChange(next);
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        tooltip="Schedule"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        <Clock className="size-4" />
        <span className="truncate max-w-[220px]">
          {formatSchedule({ frequency, hour, minute, dayOfWeek })}
        </span>
        <ArrowUp className="size-3.5 rotate-180 opacity-60" />
      </Button>
      <DropdownWrapper isOpen={open} minWidth="min-w-44" useFixedBackground>
        <div className="p-3 space-y-3">
          {/* Frequency */}
          <div>
            <div className="text-[11px] tracking-wide text-primary-500 mb-0.5">
              Frequency
            </div>
            <Select<PulseFrequency>
              value={frequency}
              options={FREQUENCY_OPTIONS}
              onChange={(val) => update({ frequency: val })}
              useFixedBackground
            />
          </div>

          {/* Day of week — only for weekly */}
          {frequency === "weekly" && (
            <div>
              <div className="text-[11px] tracking-wide text-primary-500 mb-0.5">
                Day
              </div>
              <Select<string>
                value={String(dayOfWeek ?? 1)}
                options={DAY_OPTIONS}
                onChange={(val) => update({ dayOfWeek: Number(val) })}
                useFixedBackground
              />
            </div>
          )}

          {/* Time — hourly fires on the hour, no minute picker */}
          {frequency !== "hourly" && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-primary-500 mb-1.5">
                Time
              </div>
              <Select<string>
                value={`${hour}:${minute}`}
                options={TIME_OPTIONS}
                onChange={(val) => {
                  const [h, m] = val.split(":").map(Number);
                  update({ hour: h, minute: m });
                }}
                useFixedBackground
              />
            </div>
          )}
        </div>
      </DropdownWrapper>
    </div>
  );
}

// ── Effort picker (model-aware) ────────────────────────────────────────────

export function PulseEffortPicker({
  providerId,
  modelId,
  thinkingMode,
  effortLevel,
  onChange,
}: {
  providerId: string;
  modelId: string;
  thinkingMode: boolean;
  effortLevel: string;
  onChange: (next: { thinkingMode: boolean; effortLevel: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  const { data: models = [] } = useGetProviderModelsQuery(providerId, {
    skip: !providerId,
  });
  const model = models.find((m) => m.id === modelId);
  const supported = model?.supportedEffortLevels ?? [];
  const variant: "claude" | "copilot" | "codex" | "cursor" =
    providerId === "claude_code"
      ? "claude"
      : providerId === "copilot_cli"
        ? "copilot"
        : providerId === "codex"
          ? "codex"
          : "cursor";

  // No effort levels and not claude → render nothing
  if (supported.length === 0 && variant !== "claude") return null;

  // Claude with no effort levels → simple thinking toggle
  if (supported.length === 0 && variant === "claude") {
    return (
      <Button
        tooltip="Toggle Thinking Mode"
        type="button"
        onClick={() => onChange({ thinkingMode: !thinkingMode, effortLevel: "" })}
        className={`flex items-center gap-1 px-2 py-1 rounded-xl text-s transition-all cursor-pointer animate-blur-reveal ${
          thinkingMode
            ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-700 dark:text-primary-100"
            : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
        }`}
      >
        <Brain className="size-4" />
        <span>{thinkingMode ? "On" : "Off"}</span>
      </Button>
    );
  }

  const formatLevel = (l: string) => (l === "xhigh" ? "Extra High" : l);

  return (
    <div className="relative animate-blur-reveal" ref={ref}>
      <Button
        type="button"
        tooltip="Thinking & Effort"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center px-2 py-1 gap-1 rounded-xl text-s transition-all cursor-pointer hover:bg-primary-200/30 dark:hover:bg-primary-800 ${
          thinkingMode
            ? "gap-1 text-primary-700 dark:text-primary-300"
            : "text-primary-400 dark:text-primary-300"
        }`}
      >
        <Brain className="size-4" />
        <span className={thinkingMode ? "capitalize tracking-tight" : ""}>
          {thinkingMode ? formatLevel(effortLevel) || "On" : "Off"}
        </span>
        <ArrowUp className="size-3.5 rotate-180" />
      </Button>
      <DropdownWrapper isOpen={open} minWidth="min-w-32" useFixedBackground>
        {variant !== "codex" && (
          <Button
            type="button"
            onClick={() => {
              onChange({ thinkingMode: false, effortLevel: "" });
              setOpen(false);
            }}
            className={`w-full text-left px-2.5 py-1.5 text-s cursor-pointer transition-colors first:rounded-t-sm last:rounded-b-sm ${
              !thinkingMode
                ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-700 dark:text-primary-100"
                : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
            }`}
          >
            Off
          </Button>
        )}
        {supported.map((level) => (
          <Button
            key={level}
            type="button"
            onClick={() => {
              onChange({ thinkingMode: true, effortLevel: level });
              setOpen(false);
            }}
            className={`w-full flex items-center gap-1.5 text-left px-2.5 py-1.5 text-sm cursor-pointer transition-colors capitalize last:rounded-b-xl ${
              thinkingMode && effortLevel === level
                ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-700 dark:text-primary-100"
                : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
            }`}
          >
            <Brain className="size-3" />
            {formatLevel(level)}
          </Button>
        ))}
      </DropdownWrapper>
    </div>
  );
}
