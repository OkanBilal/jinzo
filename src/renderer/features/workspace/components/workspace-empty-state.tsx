import { Copilot as CopilotIcon } from "@/components/ui/icons/mood";
import type { Workspace } from "../types";
import { useEncryptedText } from "../hooks/use-encrypted-text";
import { useRouteType } from "@/hooks/use-route-type";

interface WorkspaceEmptyStateProps {
  workspace: Workspace | null;
}
export function WorkspaceEmptyState({ workspace }: WorkspaceEmptyStateProps) {
  const routeType = useRouteType();
  const isClaudeRoute = routeType === "claude";
  const isCopilotRoute = routeType === "copilot";
  const { displayText } = useEncryptedText(
    "What can I help you build?",
    isClaudeRoute || isCopilotRoute
  );

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {isClaudeRoute ? (
        <div className="flex items-center justify-center">
          <span className="text-[#D97757] text-xl font-mono">
            {displayText}
          </span>
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center">
          {/* <CopilotIcon
            className="mb-2 text-primary-700 dark:text-copilot-lightblue/60"
            size={80}
            animate
          /> */}
            <p className="text-xl text-primary-700 dark:text-copilot-lightblue/60 font-mono mb-12">
            {displayText}
          </p>
        </div>
      )}
    </div>
  );
}
