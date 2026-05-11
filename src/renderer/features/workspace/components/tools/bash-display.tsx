import { useState } from "react";
import { Bash } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";

export interface BashParams {
  command?: string;
  description?: string;
}

export function BashDisplay({ params, output, isCompact = false }: { params: BashParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const stdout = parseStdout(output);
  const hasDetails = !!params.command || !!stdout;

  return (
    <div>
      <ToolHeader
        icon={<Bash className="size-4" />}
        verb="Ran"
        hasDetails={hasDetails}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {params.description || params.command || "command"}
        </span>
      </ToolHeader>

      {hasDetails && stdout && (
        <ToolCollapse isExpanded={isExpanded}>
          <pre className="noscrollbar text-s font-sans text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
            {stdout}
          </pre>
        </ToolCollapse>
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
const ANSI_REGEX = /[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

function stripAnsi(input: string): string {
  return input
    .replace(ANSI_REGEX, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
