import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/markdown-components";
import type { EventGroup } from "../../utils/group-events";
import { Code } from "@/components/ui/icons/space";
import { Picture, Document } from "@/components/ui/icons";
import { ProviderIcon } from "../provider-icon";

interface InfoGroupProps {
  group: EventGroup;
}

export function InfoGroup({ group }: InfoGroupProps) {
  const event = group.events[0];
  if (!event) return null;

  if (event.type === "artifact" && event.metadata?.kind === "user-prompt") {
    const message = (event.content ?? "").trim();
    const issues = (event.metadata?.issues ?? []) as Array<{
      provider: string;
      number?: number | null;
      title: string;
    }>;
    const signals = (event.metadata?.signals ?? []) as Array<{
      source: string;
      level: string;
      title: string;
    }>;
    const files = ((event.metadata?.files ?? []) as Array<{ path: string }>).map((f) => {
      const lastSlash = f.path.lastIndexOf("/");
      const fileName = f.path.substring(lastSlash + 1);
      const dir = f.path.substring(0, lastSlash);
      const parentSlash = dir.lastIndexOf("/");
      const parent = dir.substring(parentSlash + 1);
      return { fullPath: f.path, displayName: parent ? `${parent}/${fileName}` : fileName };
    });
    const attachments = (event.metadata?.attachments ?? []) as Array<{
      name: string;
      type: "image" | "document";
      mimeType: string;
    }>;

    return (
      <div className="w-full overflow-hidden">
        <div className="w-full py-2 flex justify-end">
          <div className="flex flex-col items-end gap-2 max-w-[80%]">
            <div className="px-4 py-2.5 rounded-2xl bg-primary-50 dark:bg-primary/3 ">
              <div className="text-primary-950 dark:text-primary-50">
                <p className="text-sm whitespace-pre-wrap">{message}</p>
              </div>
            </div>
            {(files.length > 0 || attachments.length > 0 || issues.length > 0 || signals.length > 0) && (
              <div className="flex flex-wrap gap-1.5 justify-end">
                {issues.map((issue) => (
                  <div
                    key={`${issue.provider}-${issue.number ?? issue.title}`}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-primary-200 dark:bg-primary-500/40 text-primary-600 dark:text-primary-100`}
                  >
                    <ProviderIcon provider={issue.provider} className="w-3 h-3" fallback="text" />
                    <span className="truncate max-w-60">
                      {issue.number ? `#${issue.number} ` : ""}{issue.title}
                    </span>
                  </div>
                ))}
                {signals.map((signal) => (
                  <div
                    key={`${signal.source}-${signal.title}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-primary-200 dark:bg-primary-500/40 text-primary-600 dark:text-primary-100"
                  >
                    <ProviderIcon provider={signal.source} className="w-3 h-3" fallback="text" />
                    <span className="truncate max-w-60">
                      {signal.title}
                    </span>
                  </div>
                ))}
                {files.map((file) => (
                  <div
                    key={file.fullPath}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-700/15 text-xs"
                    title={file.fullPath}
                  >
                    <Code className="size-3 dark:text-primary-200 text-primary-700" />
                    <span className="text-primary-700 dark:text-primary-200">
                      {file.displayName}
                    </span>
                  </div>
                ))}
                {attachments.map((att) => (
                  <div
                    key={att.name}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-700/15 text-xs"
                    title={att.name}
                  >
                    {att.type === "image" ? (
                      <Picture className="size-3 dark:text-primary-200 text-primary-700" />
                    ) : (
                      <Document className="size-3 dark:text-primary-200 text-primary-700" />
                    )}
                    <span className="text-primary-700 dark:text-primary-200">
                      {att.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (event.type === "log" && event.metadata?.level === "sdk-user") {
    return <div className="overflow-hidden" />;
  }

  if (event.type === "artifact") {
    const content = event.content;
    const isStreaming = event.metadata?.streaming === true;

    return (
      <div className="overflow-hidden">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2" />
          <div className="prose prose-sm dark:prose-invert max-w-none relative">
            <div className="size-1.5 dark:bg-primary bg-primary-950 rounded-full absolute top-2 -left-4" />
            <div className={isStreaming ? "streaming-text" : undefined}>
              <ReactMarkdown
                components={markdownComponents}
                remarkPlugins={[remarkGfm]}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-1.5 flex items-start gap-2 text-sm">
      <span className="text-primary-600 dark:text-primary-300">
        {event.content}
      </span>
    </div>
  );
}


