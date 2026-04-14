import { useState } from "react";
import { ArrowUp, Bash } from "@/components/ui/icons";

export interface BashParams {
  command?: string;
  description?: string;
}

export function BashDisplay({ params, output, isCompact = false }: { params: BashParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const stdout = parseStdout(output);

  return (
    <div className="px-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s  font-sans cursor-pointer"
      >
        <ArrowUp
          className={`size-3 shrink-0 text-primary-800  dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        {!isCompact && <Bash className="size-4 shrink-0 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            Bash
          </span>
        )}
        <span className="text-primary-500 truncate">
          {params.description || params.command || "command"}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 ml-5 space-y-2 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          {params.command && (
            <code className="noscrollbar block text-s font-sans text-primary-700 dark:text-primary-300 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded p-2 max-h-48 overflow-y-auto">
              {params.command}
            </code>
          )}
          {stdout && (
            <pre className="noscrollbar text-s font-sans text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded p-2 max-h-48 overflow-y-auto">
              {stdout}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function parseStdout(output: unknown): string | null {
  if (!output) return null;

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return parsed ? stripAnsi(parsed as string) : null;
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.stdout === "string" && obj.stdout) return stripAnsi(obj.stdout);
    if (typeof obj.content === "string" && obj.content) return stripAnsi(obj.content);
  }

  return typeof parsed === "string" ? stripAnsi(parsed) : null;
}

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

function stripAnsi(input: string): string {
  return input
    .replace(ANSI_REGEX, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
