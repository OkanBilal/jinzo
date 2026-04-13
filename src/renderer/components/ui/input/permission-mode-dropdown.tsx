import { RefObject } from "react";
import { Plan, Lock, Edit, DontAsk, Danger, ArrowUp, Bot } from "../icons";
import DropdownWrapper from "../dropdown-wrapper";
import { Button } from "../button";
import { Body } from "../text";

const PERMISSION_MODES = [
  {
    value: "default",
    label: "Ask permissions",
    description: "Always ask before making changes",
  },
  {
    value: "acceptEdits",
    label: "Auto accept edits",
    description: "Automatically accept all file edits",
  },
  {
    value: "plan",
    label: "Plan mode",
    description: "Create a plan before making changes",
  },
] as const;

const PERMISSION_MODE_LABELS: Record<string, string> = {
  default: "Ask",
  acceptEdits: "Edit",
  plan: "Plan",
  bypassPermissions: "Bypass",
  dontAsk: "Don't Ask",
};

const CURSOR_MODES = [
  {
    value: "ask",
    label: "Ask",
    description: "Answer questions without taking action",
  },
  { value: "agent", label: "Agent", description: "Full autonomous agent mode" },
  { value: "plan", label: "Plan", description: "Plan before executing" },
] as const;

const CURSOR_MODE_LABELS: Record<string, string> = {
  agent: "Agent",
  plan: "Plan",
  ask: "Ask",
};

const CODEX_SANDBOX_MODES = [
  {
    value: "read-only",
    label: "Read Only",
    description: "Agent cannot modify files",
  },
  {
    value: "workspace-write",
    label: "Workspace Write",
    description: "Write within workspace only",
  },
  {
    value: "danger-full-access",
    label: "Full Access",
    description: "No restrictions",
  },
] as const;

const CODEX_SANDBOX_LABELS: Record<string, string> = {
  "read-only": "Read Only",
  "workspace-write": "Write",
  "danger-full-access": "Full Access",
};

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
    case "bypassPermissions":
      return <Danger className={className} />;
    case "dontAsk":
      return <DontAsk className={className} />;
    case "agent":
      return <Bot className={className} />;
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

interface PermissionModeDropdownProps {
  permissionMode: string;
  onPermissionModeChange: (mode: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  variant?: string;
  modes?: readonly { value: string; label: string; description?: string }[];
  modeLabels?: Record<string, string>;
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
}: PermissionModeDropdownProps) {
  const isCursor = variant === "cursor";
  const isCodex = variant === "codex";
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
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-sm transition-all cursor-pointer animate-blur-reveal ${
          permissionMode === "bypassPermissions" ||
          permissionMode === "danger-full-access"
            ? "dark:bg-yellow-100/10 bg-yellow-400/30 text-yellow-600 dark:text-yellow-200"
            : permissionMode !== "default"
              ? "dark:bg-primary-800 bg-primary-300/30 text-primary-700 dark:text-primary-100"
              : "text-primary-700 dark:text-primary-300 hover:bg-primary/10"
        }`}
      >
        <PermissionModeIcon mode={permissionMode} className="size-3.5" />
        {modeLabels[permissionMode] ?? permissionMode}
        <ArrowUp className="size-3.5 rotate-180" />
      </Button>
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-64"
        useFixedBackground={true}
      >
        {modes.map((mode) => (
          <Button
            key={mode.value}
            type="button"
            onClick={() => {
              onPermissionModeChange(mode.value);
              onToggle();
            }}
            className={`w-full text-left px-2.5 py-1.5 cursor-pointer transition-colors flex items-center gap-2.5 first:rounded-t-xl last:rounded-b-xl ${
              permissionMode === mode.value
                ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-500 dark:text-primary-100"
                : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
            }`}
          >
            <PermissionModeIcon
              mode={mode.value}
              className="size-3.5 shrink-0"
            />
            <div className="flex flex-col flex-1 min-w-0">
              <Body className="text-s tracking-tight mb-0.5">{mode.label}</Body>
              <span className="text-xs text-primary-400 dark:text-primary-500 tracking-tighter">
                {mode.description}
              </span>
            </div>
          </Button>
        ))}
      </DropdownWrapper>
    </div>
  );
}
