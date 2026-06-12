import { useState, useCallback } from "react";
import { ArrowUp, Question } from "@/components/ui/icons";
import { Body, Button, Caption, Checkbox, Text } from "@/components/ui";
import type { ToolApprovalRequest } from "../../hooks";
import { ToolInputPreview } from "./tool-input-preview";
import { resolveTool } from "../../utils/resolve-tool";
import { VENDORS } from "../../utils/tool-registry";
import {
  usePluginLogoMap,
  renderPluginIcon,
  normalizeSlug,
  type PluginLogo,
} from "../../hooks";

const VISIBLE_PARAMS_INITIAL = 4;

interface ToolApprovalDialogProps {
  request: ToolApprovalRequest;
  onRespond: (requestId: string, approved: boolean, answer?: string) => void;
  variant?: "copilot" | "claude" | "codex" | "cursor";
}

// Fields that are either rendered elsewhere (title, browser-open URL) or are
// pure protocol metadata; never shown as a parameter row.
const META_KEYS = new Set([
  "message",
  "mode",
  "requestedSchema",
  "url",
  "serverName",
  "threadId",
  "turnId",
  "elicitationId",
  "_meta",
]);

function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatParamValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

interface ParamRow {
  label: string;
  value: unknown;
}

/**
 * Build display rows for the proposed action. Codex's app-server places the
 * proposed tool args under `_meta` on `mcpServer/elicitation/request`:
 *
 *   - `_meta.tool_params_display`: ordered list with `display_name` /
 *     `value` (preferred — already curated for the UI)
 *   - `_meta.tool_params`: raw key/value object (fallback)
 *
 * For non-elicitation approvals (Bash/Read/etc. routed through the broker
 * with a plain `{ command }` payload), top-level entries are used. The
 * schema-properties fallback only fires when there's nothing else to show.
 */
function buildParamEntries(
  toolInput: Record<string, unknown> | undefined,
): ParamRow[] {
  if (!toolInput) return [];

  const meta = isPlainObject(toolInput._meta) ? toolInput._meta : null;

  if (meta && Array.isArray(meta.tool_params_display)) {
    const rows = meta.tool_params_display
      .filter(isPlainObject)
      .map((p) => ({
        label:
          (typeof p.display_name === "string" && p.display_name) ||
          (typeof p.name === "string" && p.name) ||
          "",
        value: p.value,
      }))
      .filter((r) => r.label);
    if (rows.length > 0) return rows;
  }

  if (meta && isPlainObject(meta.tool_params)) {
    return Object.entries(meta.tool_params).map(([k, v]) => ({
      label: titleCase(k),
      value: v,
    }));
  }

  const top = Object.entries(toolInput).filter(([k]) => !META_KEYS.has(k));
  if (top.length > 0) {
    return top.map(([k, v]) => ({ label: titleCase(k), value: v }));
  }

  if (
    isPlainObject(toolInput.requestedSchema) &&
    isPlainObject(toolInput.requestedSchema.properties)
  ) {
    return Object.keys(toolInput.requestedSchema.properties).map((k) => ({
      label: titleCase(k),
      value: "",
    }));
  }

  return [];
}

/**
 * Resolve a label/icon for the dialog header. Order:
 *   1. `_meta.connector_name` (e.g. "Google Calendar") matched to VENDORS
 *      by label — set on connector elicitations routed through a bridge
 *      server like `codex_apps`.
 *   2. `toolName` matched to VENDORS by id (e.g. "computer-use") — direct
 *      elicitations from a registered vendor server.
 *   3. Generic `resolveTool` fallback (title-cased + Mcp icon).
 */
function resolveHeader(
  toolName: string,
  toolInput: Record<string, unknown> | undefined,
): { label: string; icon: React.ReactNode } {
  const meta = isPlainObject(toolInput?._meta) ? toolInput._meta : null;
  const connectorName =
    (typeof meta?.connector_name === "string" && meta.connector_name) ||
    undefined;

  if (connectorName) {
    const v = VENDORS.find(
      (v) => v.label.toLowerCase() === connectorName.toLowerCase(),
    );
    if (v) return { label: v.label, icon: v.icon };
    return { label: connectorName, icon: resolveTool(toolName).icon };
  }

  const byId = VENDORS.find((v) => v.id === toolName.toLowerCase());
  if (byId) return { label: byId.label, icon: byId.icon };

  const fallback = resolveTool(toolName);
  return { label: fallback.displayName, icon: fallback.icon };
}

/**
 * Find the codex plugin logo for this approval so the header can show the
 * plugin's real brand glyph instead of the generic MCP icon — mirroring
 * `tool-call-item.tsx`. Unlike a tool-call event (full `mcp__<slug>__…` name),
 * an approval carries the connector/server name (`"Netlify"`) plus optional
 * `_meta.connector_name`, so we try several slug spellings, all normalized so
 * separator mismatches still resolve. Returns undefined off codex (empty map)
 * or when nothing matches, letting the caller keep the static icon.
 */
function findPluginLogo(
  pluginLogos: ReadonlyMap<string, PluginLogo>,
  toolName: string,
  toolInput: Record<string, unknown> | undefined,
  vendorId: string | undefined,
): PluginLogo | undefined {
  if (pluginLogos.size === 0) return undefined;
  const meta = isPlainObject(toolInput?._meta) ? toolInput._meta : null;
  const candidates: string[] = [];
  if (typeof meta?.connector_name === "string") candidates.push(meta.connector_name);
  if (vendorId) candidates.push(vendorId);
  if (toolName) {
    candidates.push(toolName);
    // Bridge tool names arrive as `<slug>_<tool>` — index the leading slug too.
    const firstToken = toolName.split(/[\s._-]+/)[0];
    if (firstToken) candidates.push(firstToken);
  }
  for (const c of candidates) {
    const hit = pluginLogos.get(normalizeSlug(c));
    if (hit) return hit;
  }
  return undefined;
}

const RISK_LEVEL_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-700 dark:text-red-300",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function ToolApprovalDialog({
  request,
  onRespond,
  variant,
}: ToolApprovalDialogProps) {
  const isCursor = variant === "cursor";
  const isCodex = variant === "codex";
  const pluginLogos = usePluginLogoMap();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [allowForSession, setAllowForSession] = useState(false);
  const [showAllParams, setShowAllParams] = useState(false);

  const handleAllow = useCallback(() => {
    onRespond(
      request.requestId,
      true,
      allowForSession ? "acceptForSession" : undefined,
    );
  }, [request.requestId, allowForSession, onRespond]);

  const handleDeny = useCallback(() => {
    onRespond(request.requestId, false);
  }, [request.requestId, onRespond]);

  const handleSubmitAnswer = useCallback(() => {
    let answer: string;
    if (selectedOptions.length > 0) {
      answer = selectedOptions.join(", ");
    } else if (!isCursor && freeText.trim()) {
      answer = freeText.trim();
    } else {
      return;
    }
    onRespond(request.requestId, true, answer);
  }, [request.requestId, selectedOptions, freeText, isCursor, onRespond]);

  const toggleOption = useCallback(
    (label: string) => {
      if (request.multiSelect) {
        setSelectedOptions((prev) =>
          prev.includes(label)
            ? prev.filter((o) => o !== label)
            : [...prev, label],
        );
      } else {
        setSelectedOptions((prev) => (prev.includes(label) ? [] : [label]));
      }
    },
    [request.multiSelect],
  );

  const canSubmit =
    selectedOptions.length > 0 || (!isCursor && freeText.trim().length > 0);

  if (request.kind === "ask_user") {
    return (
      <div className="mx-auto mb-1 max-w-210 ">
        <div className="overflow-hidden rounded-2xl  glass-morphism">
          <div className="flex gap-3 px-3.5 pb-2 pt-3.5 sm:px-4 sm:pt-4">
            <Question className="mt-0.5 size-4 shrink-0 text-primary-600 dark:text-primary-400" />
            <div className="min-w-0 flex-1 space-y-2">
              {request.multiSelect && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-primary-100/50 px-1.5 py-0.5 text-xxs font-medium text-primary-600 dark:bg-primary-900/40 dark:text-primary-400">
                    Multi-select
                  </span>
                </div>
              )}
              <Body className="leading-snug font-medium">
                {request.question || "The agent is asking a question."}
              </Body>
            </div>
          </div>

          {request.options && request.options.length > 0 && (
            <div className="space-y-2 px-3.5 pb-3 sm:px-4">
              {request.options.map((opt) => {
                const isSelected = selectedOptions.includes(opt.label);
                return (
                  <Button
                    key={opt.label}
                    type="button"
                    onClick={() => toggleOption(opt.label)}
                    className={`flex w-full gap-2.5 rounded-lg  px-2.5 py-2.5 text-left text-xs transition-colors ${
                      isSelected
                        ? " bg-emerald-500/8  dark:bg-emerald-500/10"
                        : " bg-primary-100/30 hover:border-primary-300/70 dark:bg-primary-800/50 dark:hover:border-primary-600/50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded ${
                        isSelected
                          ? " bg-emerald-500 text-primary dark:bg-emerald-600"
                          : " bg-primary-50 dark:border-primary-600 dark:bg-primary-900/50"
                      }`}
                      aria-hidden
                    >
                      {isSelected && (
                        <span className="text-[10px] font-bold leading-none text-primary">
                          ✓
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span
                        className={`font-semibold ${
                          isSelected
                            ? "text-emerald-800 dark:text-emerald-200"
                            : "text-primary-800 dark:text-primary-200"
                        }`}
                      >
                        {opt.label}
                      </span>
                      {opt.description && (
                        <Text className="mt-1 text-xxs leading-relaxed text-primary-600 dark:text-primary-400">
                          {opt.description}
                        </Text>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          )}

          <div className="border-t border-primary-200/40 px-3.5 py-3 dark:border-primary-700/25 sm:px-4">
            <div
              className={`flex flex-col gap-3 sm:flex-row sm:items-end ${isCursor ? "sm:justify-end" : ""}`}
            >
              {!isCursor && (
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Custom answer</span>
                  <input
                    type="text"
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitAnswer();
                    }}
                    placeholder="Type a custom answer…"
                    className="w-full rounded-lg bg-primary-100/50   px-3 py-2 text-xs text-primary-950 transition-colors placeholder:text-primary-500 focus:outline-none dark:bg-primary-800/50 dark:text-primary-100 dark:placeholder:text-primary-500"
                  />
                </label>
              )}
              <div className="flex shrink-0 items-center justify-end gap-2 sm:pb-px">
                <Button
                  variant="primary"
                  size="xs"
                  className="min-w-18  text-primary-700 hover:bg-primary-200/40  dark:text-primary-300 dark:hover:bg-primary-800/50"
                  onClick={handleDeny}
                >
                  Dismiss
                </Button>
                <Button
                  variant="submit"
                  size="xs"
                  className="min-w-18 font-semibold shadow-sm disabled:opacity-45"
                  onClick={handleSubmitAnswer}
                  disabled={!canSubmit}
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Builtin tools (Bash/Read/Edit/…) have rich specialized renderers in
  // ToolInputPreview (code blocks, diffs, file paths). Elicitations and
  // unknown tools fall back to a generic key-value table.
  const resolved = resolveTool(request.toolName);
  const header = resolveHeader(request.toolName, request.toolInput);
  // Swap the generic header glyph for the codex plugin's real logo when one
  // matches (same treatment tool-call-item gives plugin tool calls).
  const pluginLogo = findPluginLogo(
    pluginLogos,
    request.toolName,
    request.toolInput,
    resolved.vendorId,
  );
  const headerIcon = renderPluginIcon(pluginLogo) ?? header.icon;
  const meta = isPlainObject(request.toolInput?._meta)
    ? request.toolInput._meta
    : null;
  const subtitle =
    typeof meta?.subtitle === "string" ? meta.subtitle : undefined;
  const riskLevel =
    typeof meta?.riskLevel === "string"
      ? meta.riskLevel.toLowerCase()
      : undefined;
  const message =
    (request.toolInput?.message as string | undefined) ??
    `Allow ${header.label}?`;
  const showRichPreview = resolved.isBuiltin && !!request.toolInput;
  const paramEntries = !showRichPreview
    ? buildParamEntries(request.toolInput)
    : [];
  const hiddenCount = Math.max(0, paramEntries.length - VISIBLE_PARAMS_INITIAL);
  const initialParamEntries = paramEntries.slice(0, VISIBLE_PARAMS_INITIAL);
  const extraParamEntries = paramEntries.slice(VISIBLE_PARAMS_INITIAL);
  const hasBody = showRichPreview || paramEntries.length > 0;

  return (
    <div className="mr-auto mb-1 max-w-210">
      <div className="overflow-hidden rounded-2xl glass-morphism">
        <div className="flex items-center gap-2 px-4 pb-1 pt-3.5">
          <span className="text-primary-500 dark:text-primary-400">
            {headerIcon}
          </span>
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {header.label}
          </span>
          {riskLevel && RISK_LEVEL_STYLES[riskLevel] && (
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-xxs font-medium capitalize ${RISK_LEVEL_STYLES[riskLevel]}`}
            >
              {riskLevel} risk
            </span>
          )}
        </div>

        <div className="px-4 pb-3 pt-0.5">
          <Body className="font-medium leading-snug">
            {message}
          </Body>
          {subtitle && (
            <Caption className="mt-1.5">
              {subtitle}
            </Caption>
          )}
        </div>

        {hasBody && (
          <div className="px-4 pb-3">
            {showRichPreview ? (
              <ToolInputPreview
                toolName={request.toolName}
                toolInput={request.toolInput}
              />
            ) : (
              <div className="space-y-1.5 text-xs">
                {initialParamEntries.map((entry, idx) => (
                  <div key={`${entry.label}-${idx}`} className="flex gap-3">
                    <div className="w-28 shrink-0 text-primary-500 dark:text-primary-400">
                      {entry.label}
                    </div>
                    <div className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-primary-900 dark:text-primary-100">
                      {formatParamValue(entry.value)}
                    </div>
                  </div>
                ))}
                {extraParamEntries.length > 0 && (
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
                    style={{
                      gridTemplateRows: showAllParams ? "1fr" : "0fr",
                    }}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="space-y-1.5 pt-0">
                        {extraParamEntries.map((entry, idx) => (
                          <div
                            key={`${entry.label}-${idx + VISIBLE_PARAMS_INITIAL}`}
                            className="flex gap-3"
                          >
                            <div className="w-28 shrink-0 text-primary-500 dark:text-primary-400">
                              {entry.label}
                            </div>
                            <div className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-primary-900 dark:text-primary-100">
                              {formatParamValue(entry.value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {hiddenCount > 0 && (
                  <Button
                    aria-expanded={showAllParams}
                    onClick={() => setShowAllParams((v) => !v)}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-200"
                  >
                    <span>
                      {showAllParams
                        ? "Show fewer"
                        : `Show ${hiddenCount} more item${hiddenCount === 1 ? "" : "s"}`}
                    </span>
                    <ArrowUp
                      className={`size-3.5 shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none ${
                        showAllParams ? "rotate-180" : "rotate-90"
                      }`}
                      aria-hidden
                    />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-4 py-2">
          {isCodex ? (
            <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-primary-500 dark:text-primary-400 mb-2">
              <Checkbox
                checked={allowForSession}
                onChange={() => setAllowForSession((v) => !v)}
              />
              Allow for this run
            </label>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2 mb-2">
            <Button variant="secondary" size="xs" onClick={handleDeny}>
              Cancel
            </Button>
            <Button variant="submit" size="xs" onClick={handleAllow}>
              Allow
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
