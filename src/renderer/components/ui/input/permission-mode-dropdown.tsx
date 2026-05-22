import { RefObject } from "react";
import { Plan, Lock, Edit, DontAsk, Danger, ArrowUp, Infinite } from "../icons";
import DropdownWrapper from "../dropdown-wrapper";
import { Button } from "../button";
import { Body, Caption } from "../text";
import {
  CURSOR_MODES as CURSOR_MODE_DEFS,
  CODEX_SANDBOX_MODES as CODEX_SANDBOX_MODE_DEFS,
  shortLabelMap,
} from "@/lib/provider-modes";

const PERMISSION_MODES = [
  {
    value: "default",
    label: "Ask permissions",
    description: "Ask before changes",
  },
  {
    value: "acceptEdits",
    label: "Auto accept edits",
    description: "Accept all edits",
  },
  {
    value: "plan",
    label: "Plan mode",
    description: "Plan before changes",
  },
  {
    value: "bypassPermissions",
    label: "Bypass permissions",
    description: "Bypass all permissions",
  },
] as const;

const PERMISSION_MODE_LABELS: Record<string, string> = {
  default: "Ask",
  acceptEdits: "Edit",
  plan: "Plan",
  auto: "Auto",
  bypassPermissions: "Bypass",
  dontAsk: "Don't Ask",
};

const CURSOR_MODES = CURSOR_MODE_DEFS;
const CURSOR_MODE_LABELS = shortLabelMap(CURSOR_MODE_DEFS);
const CODEX_SANDBOX_MODES = CODEX_SANDBOX_MODE_DEFS;
const CODEX_SANDBOX_LABELS = shortLabelMap(CODEX_SANDBOX_MODE_DEFS);

function PermissionModeIcon({
  mode,
  className,
}: {
  mode: string;
  className?: string;
}) {
  switch (mode) {
    case "acceptEdits":
      return <Edit className={className} />;
    case "plan":
      return <Plan className={className} />;
    case "auto":
      return <Infinite className={className} />;
    case "bypassPermissions":
      return <Danger className={className} />;
    case "dontAsk":
      return <DontAsk className={className} />;
    case "agent":
      return <Infinite className={className} />;
    case "read-only":
      return <Lock className={className} />;
    case "workspace-write":
      return <Edit className={className} />;
    case "danger-full-access":
      return <Danger className={className} />;
    default:
      return <Lock className={className} />;
  }
}

function PlanToggleSwitch({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
        checked
          ? "bg-primary-500 dark:bg-primary-400"
          : "bg-primary-300/60 dark:bg-primary-700"
      }`}
    >
      <span
        className={`inline-block size-3 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </span>
  );
}

interface PermissionModeDropdownProps {
  permissionMode: string;
  onPermissionModeChange: (mode: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  variant?: string;
  modes?: readonly { value: string; label: string; description?: string }[];
  modeLabels?: Record<string, string>;
  /** Codex-only: plan mode runs alongside the sandbox mode. */
  planMode?: boolean;
  onPlanModeToggle?: () => void;
}

export function PermissionModeDropdown({
  permissionMode,
  onPermissionModeChange,
  isOpen,
  onToggle,
  dropdownRef,
  variant,
  modes: modesProp,
  modeLabels: modeLabelsProp,
  planMode = false,
  onPlanModeToggle,
}: PermissionModeDropdownProps) {
  const isCursor = variant === "cursor";
  const isCodex = variant === "codex";
  const showPlanRow = isCodex && !!onPlanModeToggle;
  const modes =
    modesProp ??
    (isCursor
      ? CURSOR_MODES
      : isCodex
        ? CODEX_SANDBOX_MODES
        : PERMISSION_MODES);
  const modeLabels =
    modeLabelsProp ??
    (isCursor
      ? CURSOR_MODE_LABELS
      : isCodex
        ? CODEX_SANDBOX_LABELS
        : PERMISSION_MODE_LABELS);
  return (
    <div className="relative mx-0.5" ref={dropdownRef}>
      <Button
        tooltip="Permission Mode"
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-sm transition-all cursor-pointer hover:bg-primary-200/30 animate-blur-reveal dark:hover:bg-primary-800  ${
          permissionMode === "bypassPermissions" ||
          permissionMode === "danger-full-access"
            ? "dark:bg-yellow-300/10 hover:dark:bg-yellow-300/10 hover:bg-yellow-400/30  bg-yellow-400/30 text-yellow-600 dark:text-yellow-300"
            : permissionMode !== "default"
              ? " text-primary-700 dark:text-primary-300"
              : "text-primary-700 dark:text-primary-300 "
        }`}
      >
        <PermissionModeIcon mode={permissionMode} className="size-3.5" />
        {modeLabels[permissionMode] ?? permissionMode}
        {showPlanRow && planMode ? " + Plan" : ""}
        <ArrowUp className="size-3.5 rotate-180" />
      </Button>
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-64"
      >
        {modes.map((mode) => (
          <Button
            key={mode.value}
            type="button"
            onClick={() => {
              onPermissionModeChange(mode.value);
              onToggle();
            }}
            className={`w-full text-left px-2.5 py-1.5 cursor-pointer transition-colors flex items-center gap-2.5 first:rounded-t-xl ${
              !showPlanRow ? "last:rounded-b-xl" : ""
            } ${
              permissionMode === mode.value
                ? "bg-primary-200/60 dark:bg-primary-200/10 text-primary-500 dark:text-primary-100"
                : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
            }`}
          >
            <PermissionModeIcon
              mode={mode.value}
              className="size-3.5 shrink-0"
            />
            <div className="flex flex-col flex-1 min-w-0">
              <Body className="mb-0.5">{mode.label}</Body>
              <Caption>
                {mode.description}
              </Caption>
            </div>
          </Button>
        ))}
        {showPlanRow && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onPlanModeToggle?.()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPlanModeToggle?.();
              }
            }}
            className={`w-full text-left px-2.5 py-1.5 cursor-pointer transition-colors flex items-center gap-2.5 last:rounded-b-xl border-t border-primary-200/40 dark:border-primary/5 ${
              planMode
                ? "bg-primary-200/60 dark:bg-primary-200/10 text-primary-500 dark:text-primary-100"
                : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
            }`}
          >
            <Plan className="size-3.5 shrink-0" />
            <div className="flex flex-col flex-1 min-w-0">
              <Body className="mb-0.5">Plan Mode</Body>
              <Caption>
                Plan before changes
              </Caption>
            </div>
            <PlanToggleSwitch checked={planMode} />
          </div>
        )}
      </DropdownWrapper>
    </div>
  );
}
