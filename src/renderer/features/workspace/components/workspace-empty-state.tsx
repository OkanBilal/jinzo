import type { Workspace } from "../types";
import { useEncryptedText } from "../hooks/use-encrypted-text";
import { useRouteType } from "@/hooks/use-route-type";

interface WorkspaceEmptyStateProps {
  workspace: Workspace | null;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function WorkspaceEmptyState({ workspace }: WorkspaceEmptyStateProps) {
  const routeType = useRouteType();
  const isClaudeRoute = routeType === "claude";
  const isCopilotRoute = routeType === "copilot";
  const { displayText } = useEncryptedText(
    "What can I help you build?",
    isClaudeRoute || isCopilotRoute
  );

  return (
    <div className=" flex flex-col items-center justify-center h-full">
      {isClaudeRoute ? (
        <div className="flex items-center justify-center">
          <span className="dark:text-primary-800 text-primary-300 text-lg font-mono tracking-wide">
            {displayText}
          </span>
        </div>
      ) : (
        <div className=" flex flex-col items-center">
          {/* <CopilotIcon
            className="mb-2 text-primary-700 dark:text-copilot-light/60"
            size={80}
            animate
          /> */}
          <span className="dark:text-primary-800 text-primary-300 text-lg font-mono tracking-wide">
          {displayText}
          </span>
        </div>
      )}
    </div>
  );
}
