import { useState } from "react";
import { ArrowUp, Mains } from "@/components/ui/icons";

interface PackageInfo {
  name: string;
  version?: string;
  ecosystem?: string;
}

export interface CheckPackageParams {
  packages?: PackageInfo[];
}

export function CheckPackageDisplay({
  params,
  output,
  isCompact = false,
}: {
  params: CheckPackageParams;
  output?: unknown;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const packages = params.packages || [];
  const hasContent = packages.length > 0;
  const outputText = typeof output === "string" ? output : "";

  // Parse results from output text
  const results = parseResults(outputText);
  const blockedCount = results.filter((r) => r.blocked).length;
  const allPassed = hasContent && results.length > 0 && blockedCount === 0;

  const summaryText = packages.length > 0
    ? packages.map((p) => p.name).join(", ")
    : "No packages";

  return (
    <div className="">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-primary-400 dark:text-primary-500 text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Mains className="size-3.5 shrink-0 text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-400 dark:text-primary-500 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            CheckPackage
          </span>
        )}
        {blockedCount > 0 && (
          <span className="text-red-500 dark:text-red-400 text-xs font-medium shrink-0">
            {blockedCount} blocked
          </span>
        )}
        {allPassed && (
          <span className="text-green-500 dark:text-green-400 text-xs font-medium shrink-0">
            passed
          </span>
        )}
        <span className="text-primary-400 dark:text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {summaryText}
        </span>
        {hasContent && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-400 dark:text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasContent && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-1">
              {results.length > 0 ? (
                results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-xs font-mono py-0.5 ${
                      r.blocked
                        ? "text-red-500 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    <span>{r.blocked ? "\u2718" : "\u2714"}</span>
                    <span className="font-medium">{r.name}</span>
                    {r.score && (
                      <span className="text-primary-400 dark:text-primary-500">
                        score: {r.score}
                      </span>
                    )}
                    {r.reason && (
                      <span className="text-primary-400 dark:text-primary-500 truncate">
                        {r.reason}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                packages.map((p, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono text-primary-500 py-0.5"
                  >
                    {p.name}{p.version ? `@${p.version}` : ""}{p.ecosystem && p.ecosystem !== "npm" ? ` (${p.ecosystem})` : ""}
                  </div>
                ))
              )}
              {outputText && results.length === 0 && (
                <p className="text-s text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 mt-1">
                  {outputText}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ParsedResult {
  name: string;
  blocked: boolean;
  score?: string;
  reason?: string;
}

function parseResults(output: string): ParsedResult[] {
  if (!output) return [];
  const results: ParsedResult[] = [];

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const blocked = trimmed.startsWith("\u274C") || trimmed.includes("BLOCKED");
    const allowed = trimmed.startsWith("\u2705") || trimmed.includes("ALLOWED");
    if (!blocked && !allowed) continue;

    // Extract package name (first word after status emoji/label)
    const nameMatch = trimmed.match(/(?:ALLOWED|BLOCKED)\s+(\S+)/);
    const name = nameMatch?.[1] || "unknown";

    // Extract score
    const scoreMatch = trimmed.match(/score:\s*(\d+)\/100/);
    const score = scoreMatch?.[1];

    // Extract reason after last |
    const parts = trimmed.split("|");
    const reason = parts.length > 1 ? parts[parts.length - 1].trim() : undefined;

    results.push({ name, blocked, score, reason });
  }

  return results;
}
