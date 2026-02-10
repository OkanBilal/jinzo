import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/features/chat/components/markdown-components";
import { parseUserPromptWithFiles } from "../../utils/parse-user-prompt";
import type { EventGroup } from "../../utils/group-events";
import { Code } from "@/components/ui/icons/mood";

interface InfoGroupProps {
  group: EventGroup;
}

export function InfoGroup({ group }: InfoGroupProps) {
  const event = group.events[0];
  if (!event) return null;

  if (event.type === "artifact" && event.metadata?.kind === "user-prompt") {
    // Parse file paths from content and format them nicely
    const { message, files } = parseUserPromptWithFiles(event.content);

    return (
      <div className="w-full overflow-hidden">
        <div className="w-full py-2 flex justify-end">
          <div className="flex flex-col items-end gap-2 max-w-[80%]">
            <div className="px-4 py-2.5 rounded-2xl bg-primary-50 dark:bg-primary-300/15">
              <div className="text-primary-950 dark:text-primary-50">
                <p className="text-sm whitespace-pre-wrap">{message}</p>
              </div>
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-end">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-300/15 text-xs"
                    title={file.fullPath}
                  >
                    <Code className="size-3 dark:text-primary-200 text-primary-700" />
                    <span className="text-primary-700 dark:text-primary-200">
                      {file.displayName}
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

    return (
      <div className="overflow-hidden">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2" />
          <div className="prose prose-sm dark:prose-invert max-w-none relative">
            <div className="size-1.5 dark:bg-primary bg-primary-950 rounded-full absolute top-2 -left-4" />
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {content}
            </ReactMarkdown>
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
