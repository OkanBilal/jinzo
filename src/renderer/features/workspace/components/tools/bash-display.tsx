import { useState } from "react";
import { ArrowUp, Bash } from "@/components/ui/icons";

export interface BashParams {
  command?: string;
  description?: string;
}

export function BashDisplay({ params, output, isCompact = false }: { params: BashParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const stdout = parseStdout(output);
  const hasDetails = !!params.command || !!stdout;

  return (
    <div className="">
      <button
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-s font-sans ${hasDetails ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Bash className="size-4 shrink-0 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-500 dark:text-primary-300 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            Ran
          </span>
        )}
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {params.description || params.command || "command"}
        </span>
        {hasDetails && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasDetails && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className=" ">
              {stdout && (
                <pre className="noscrollbar text-s font-sans text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
                  {stdout}
                </pre>
              )}
            </div>
          </div>
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
