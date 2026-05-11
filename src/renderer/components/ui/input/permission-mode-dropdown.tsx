import { RefObject } from "react";
import { Plan, Lock, Edit, DontAsk, Danger, ArrowUp, Infinite } from "../icons";
import DropdownWrapper from "../dropdown-wrapper";
import { Button } from "../button";
import { Body } from "../text";
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
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-sm transition-all cursor-pointer hover:bg-primary-200/30 animate-blur-reveal dark:hover:bg-primary-800  ${
          permissionMode === "bypassPermissions" ||
          permissionMode === "danger-full-access"
            ? "dark:bg-yellow-100/10 hover:bg-yellow-500/30  bg-yellow-400/30 text-yellow-600 dark:text-yellow-200"
            : permissionMode !== "default"
              ? " text-primary-700 dark:text-primary-300"
              : "text-primary-700 dark:text-primary-300 "
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
              <Body className="text-s mb-0.5">{mode.label}</Body>
              <span className="text-xs text-primary-500  ">
                {mode.description}
              </span>
            </div>
          </Button>
        ))}
      </DropdownWrapper>
    </div>
  );
}
