import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  Bot,
  Brain,
  Clock,
  Project,
} from "@/components/ui/icons";
import { Earth } from "@/components/ui/icons/space";
import { formatEffortLevel } from "@/lib/format";
import {
  getProviderVariantById,
  type ProviderVariant,
} from "@/lib/provider-variants";
import { ProjectIcon } from "@/components/layout/sidebar/project-icon";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import Select from "@/components/ui/select";
import { useClickOutside } from "@/hooks/use-click-outside";
import {
  getModelIcon,
  dedupeModelsByPrettyName,
  getModelPrettyName,
  type ModelIconVariant,
} from "@/lib/model-icons";
import { useListProjectsQuery } from "@/lib/redux/api/projectsApi";
import {
  useListWorkspaceGitStatesQuery,
  useListWorkspacesQuery,
} from "@/lib/redux/api/workspaceApi";
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
import type { Workspace } from "@/lib/redux/api/workspaceApi";
import {
  PROVIDER_IDS,
  type ProviderId,
} from "../../../../shared/provider-ids";

// Local copy keeps the picker's display order (Claude first) separate from
// the registry tuple's ordering (Copilot first).
const SUPPORTED_PROVIDER_IDS = [
  PROVIDER_IDS.claude,
  PROVIDER_IDS.copilot,
  PROVIDER_IDS.codex,
  PROVIDER_IDS.cursor,
] as const satisfies readonly ProviderId[];

function providerLabel(id: string, fallback: string): string {
  return getProviderVariantById(id)?.label ?? fallback;
}

function ProviderIcon({ id, className }: { id: string; className?: string }) {
  const Icon = getProviderVariantById(id)?.icon;
  if (!Icon) return null;
  return <Icon className={className ?? "size-4"} />;
}

// ── Shared picker primitives ────────────────────────────────────
// Every picker is the same shell: a trigger pill that toggles a
// DropdownWrapper, closed on outside click, with selected/hover option rows.

const triggerClass =
  "flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-s transition-all cursor-pointer animate-blur-reveal text-primary-700 dark:text-primary-300 hover:bg-primary-200/30 dark:hover:bg-primary-800";

function usePickerState() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  useClickOutside(ref, close);
  return { open, ref, toggle, close };
}

function PickerTrigger({
  tooltip,
  onClick,
  disabled = false,
  className = "",
  chevronClassName = "size-3.5 rotate-180",
  children,
}: {
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  chevronClassName?: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      tooltip={tooltip}
      disabled={disabled}
      onClick={onClick}
      className={`${triggerClass} ${className}`}
    >
      {children}
      <ArrowUp className={chevronClassName} />
    </Button>
  );
}

function PickerOption({
  selected,
  onSelect,
  className = "",
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-sm cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl ${
        selected
          ? "bg-primary-200/60 dark:bg-primary-200/10 text-primary-700 dark:text-primary-100"
          : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
      } ${className}`}
    >
      {children}
    </Button>
  );
}

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

function workspacePickTitle(
  w: Pick<Workspace, "name">,
  branch?: string | null,
) {
  const currentBranch = branch?.trim();
  return currentBranch ? `${w.name}\n${currentBranch}` : w.name;
}

function WorkspacePickRows({
  w,
  branch,
  title,
  textColumnClassName,
  projectIcon,
  showIcon = true,
}: {
  w: Pick<Workspace, "name">;
  branch?: string | null;
  title?: string;
  textColumnClassName?: string;
  /** Resolved from workspace project when available; falls back to generic Project glyph */
  projectIcon?: ReactNode;
  showIcon?: boolean;
}) {
  const currentBranch = branch?.trim();
  const textColumn = (
    <div
      className={`min-w-0 flex-1 text-left leading-tight ${textColumnClassName ?? ""}`}
    >
      <div
        className="truncate"
        title={title ?? workspacePickTitle(w, currentBranch)}
      >
        {w.name}
      </div>
      {currentBranch ? (
        <div
          className="truncate text-xxs text-primary-500 dark:text-primary-400"
          title={currentBranch}
        >
          {currentBranch}
        </div>
      ) : null}
    </div>
  );
  if (!showIcon) return textColumn;
  return (
    <>
      <span className="shrink-0 self-center flex items-center justify-center">
        {projectIcon ?? (
          <Project className="size-3.5 text-primary-900 dark:text-primary-300" />
        )}
      </span>
      {textColumn}
    </>
  );
}

function workspaceProjectIcon(
  workspace: Pick<Workspace, "projectId">,
  projectDataMap: Map<string, { name: string; icon: string | null }>,
): ReactNode | undefined {
  if (!workspace.projectId) return undefined;
  const pd = projectDataMap.get(workspace.projectId);
  if (!pd) return undefined;
  return <ProjectIcon icon={pd.icon} projectName={pd.name} />;
}

export function WorkspacePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { open, ref, toggle, close } = usePickerState();
  const { data: workspaces = [] } = useListWorkspacesQuery();
  const { data: gitStates = [] } = useListWorkspaceGitStatesQuery();
  const { data: projects = [] } = useListProjectsQuery();
  const branchByWorkspaceId = useMemo(
    () =>
      new Map(
        gitStates.map((state) => [state.workspaceId, state.branch] as const),
      ),
    [gitStates],
  );
  const projectDataMap = useMemo(() => {
    const map = new Map<string, { name: string; icon: string | null }>();
    for (const project of projects) {
      map.set(project.id, { name: project.name, icon: project.icon });
    }
    return map;
  }, [projects]);
  const active = workspaces.filter((w) => !w.isArchived);
  const selected = active.find((w) => w.id === value);

  return (
    <div className="relative" ref={ref}>
      <PickerTrigger tooltip="Select workspace" onClick={toggle}>
        {selected ? (
          <div className="flex items-center gap-2">
            {workspaceProjectIcon(selected, projectDataMap)}
            <span className="truncate max-w-50">{selected.name}</span>
          </div>
        ) : (
          <>
            <Project className="size-3.5 shrink-0" />
            <span className="truncate max-w-50">Select workspace</span>
          </>
        )}
      </PickerTrigger>
      <DropdownWrapper isOpen={open} minWidth="min-w-44">
        {active.length === 0 && (
          <div className="px-3 py-2 text-xs text-primary-500">
            No active workspaces
          </div>
        )}
        <div className="max-h-64 overflow-auto noscrollbar">
          {active.map((w) => (
            <PickerOption
              key={w.id}
              selected={value === w.id}
              onSelect={() => {
                onChange(w.id);
                close();
              }}
            >
              <WorkspacePickRows
                w={w}
                branch={branchByWorkspaceId.get(w.id)}
                projectIcon={workspaceProjectIcon(w, projectDataMap)}
              />
            </PickerOption>
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
  const { open, ref, toggle, close } = usePickerState();
  const { data: providers = [] } = useGetEnabledProvidersQuery();
  const eligible = providers.filter((p) =>
    (SUPPORTED_PROVIDER_IDS as readonly string[]).includes(p.id),
  );
  const selected = eligible.find((p) => p.id === value);

  return (
    <div className="relative" ref={ref}>
      <PickerTrigger tooltip="Select provider" onClick={toggle}>
        {selected ? (
          <ProviderIcon id={selected.id} className="size-4" />
        ) : (
          <Earth className="size-4" />
        )}
        <span>{selected ? providerLabel(selected.id, selected.displayName) : "Provider"}</span>
      </PickerTrigger>
      <DropdownWrapper isOpen={open} minWidth="min-w-44">
        {eligible.length === 0 && (
          <div className="px-3 py-2 text-xs text-primary-500">
            No enabled providers
          </div>
        )}
        {eligible.map((p) => (
          <PickerOption
            key={p.id}
            selected={value === p.id}
            onSelect={() => {
              onChange(p.id);
              close();
            }}
          >
            <ProviderIcon id={p.id} className="size-4 shrink-0" />
            <span>{providerLabel(p.id, p.displayName)}</span>
          </PickerOption>
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
  const { open, ref, toggle, close } = usePickerState();
  const { data: models = [] } = useGetProviderModelsQuery(providerId, {
    skip: !providerId,
  });
  const variant: ModelIconVariant | undefined =
    getProviderVariantById(providerId)?.variant;
  const selectableModels = dedupeModelsByPrettyName(models, variant);
  const selected = models.find((m) => m.id === value);
  const selectedDisplay = selected
    ? getModelPrettyName(selected, variant)
    : undefined;

  return (
    <div className="relative" ref={ref}>
      <PickerTrigger
        tooltip="Select model"
        disabled={!providerId}
        onClick={toggle}
        className={!providerId ? "opacity-40 cursor-not-allowed" : ""}
      >
        {selectedDisplay ? (
          getModelIcon(selectedDisplay, variant)
        ) : (
          <Bot className="size-4" />
        )}
        <span className="truncate max-w-35">
          {selectedDisplay ?? "Model"}
        </span>
      </PickerTrigger>
      <DropdownWrapper isOpen={open} minWidth="min-w-56">
        {models.length === 0 && (
          <div className="px-3 py-2 text-xs text-primary-500">
            {providerId ? "Loading models…" : "Select a provider first"}
          </div>
        )}
        <div className="max-h-64 overflow-auto noscrollbar">
          {selectableModels.map((m) => {
            const displayName = getModelPrettyName(m, variant);
            return (
              <PickerOption
                key={m.id}
                selected={value === m.id}
                onSelect={() => {
                  onChange(m.id, m.supportedEffortLevels);
                  close();
                }}
              >
                {getModelIcon(displayName, variant)}
                <span className="truncate">{displayName}</span>
              </PickerOption>
            );
          })}
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
  const { open, ref, toggle } = usePickerState();

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
      <PickerTrigger
        tooltip="Schedule"
        onClick={toggle}
        chevronClassName="size-3.5 rotate-180 opacity-60"
      >
        <Clock className="size-4" />
        <span className="truncate max-w-55">
          {formatSchedule({ frequency, hour, minute, dayOfWeek })}
        </span>
      </PickerTrigger>
      <DropdownWrapper isOpen={open} minWidth="min-w-44">
        <div className="p-3 space-y-3">
          {/* Frequency */}
          <div>
            <div className="text-xxs tracking-wide text-primary-500 mb-0.5">
              Frequency
            </div>
            <Select<PulseFrequency>
              value={frequency}
              options={FREQUENCY_OPTIONS}
              onChange={(val) => update({ frequency: val })}
            />
          </div>

          {/* Day of week — only for weekly */}
          {frequency === "weekly" && (
            <div>
              <div className="text-xxs tracking-wide text-primary-500 mb-0.5">
                Day
              </div>
              <Select<string>
                value={String(dayOfWeek ?? 1)}
                options={DAY_OPTIONS}
                onChange={(val) => update({ dayOfWeek: Number(val) })}
              />
            </div>
          )}

          {/* Time — hourly fires on the hour, no minute picker */}
          {frequency !== "hourly" && (
            <div>
              <div className="text-xxs tracking-wide text-primary-500 mb-0.5">
                Time
              </div>
              <Select<string>
                value={`${hour}:${minute}`}
                options={TIME_OPTIONS}
                onChange={(val) => {
                  const [h, m] = val.split(":").map(Number);
                  update({ hour: h, minute: m });
                }}
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
  const { open, ref, toggle, close } = usePickerState();
  const { data: models = [] } = useGetProviderModelsQuery(providerId, {
    skip: !providerId,
  });
  const model = models.find((m) => m.id === modelId);
  const supported = model?.supportedEffortLevels ?? [];
  const variant: ProviderVariant =
    getProviderVariantById(providerId)?.variant ?? "cursor";

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
            ? "bg-primary-200/60 dark:bg-primary-200/10 text-primary-700 dark:text-primary-100"
            : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
        }`}
      >
        <Brain className="size-4" />
        <span>{thinkingMode ? "On" : "Off"}</span>
      </Button>
    );
  }

  return (
    <div className="relative animate-blur-reveal" ref={ref}>
      <Button
        type="button"
        tooltip="Thinking & Effort"
        onClick={toggle}
        className={`flex items-center px-2 py-1 gap-1 rounded-xl text-s transition-all cursor-pointer hover:bg-primary-200/30 dark:hover:bg-primary-800 ${
          thinkingMode
            ? "gap-1 text-primary-700 dark:text-primary-300"
            : "text-primary-400 dark:text-primary-300"
        }`}
      >
        <Brain className="size-4" />
        <span className={thinkingMode ? "capitalize tracking-tight" : ""}>
          {thinkingMode ? formatEffortLevel(effortLevel) || "On" : "Off"}
        </span>
        <ArrowUp className="size-3.5 rotate-180" />
      </Button>
      <DropdownWrapper isOpen={open} minWidth="min-w-32">
        {variant !== "codex" && (
          <PickerOption
            selected={!thinkingMode}
            onSelect={() => {
              onChange({ thinkingMode: false, effortLevel: "" });
              close();
            }}
          >
            Off
          </PickerOption>
        )}
        {supported.map((level) => (
          <PickerOption
            key={level}
            selected={thinkingMode && effortLevel === level}
            onSelect={() => {
              onChange({ thinkingMode: true, effortLevel: level });
              close();
            }}
            className="gap-1.5 capitalize"
          >
            <Brain className="size-3" />
            {formatEffortLevel(level)}
          </PickerOption>
        ))}
      </DropdownWrapper>
    </div>
  );
}
