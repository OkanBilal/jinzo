import { Copilot as CopilotIcon } from "@/components/ui/icons/mood";
import type { Workspace } from "../types";
import { useAsciiLoader } from "../hooks/use-ascii-loader";
import { useRouteType } from "@/hooks/use-route-type";

interface WorkspaceEmptyStateProps {
  workspace: Workspace | null;
}
export function WorkspaceEmptyState({ workspace }: WorkspaceEmptyStateProps) {
  const routeType = useRouteType();
  const isClaudeRoute = routeType === "claude";
  const { spinner } = useAsciiLoader(isClaudeRoute);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {isClaudeRoute ? (
        <div className="flex items-center justify-center">
          <span className=" text-[#D97757] text-5xl">
            {spinner}
          </span>
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center">
          <CopilotIcon
            className="mb-2 text-primary-700 dark:text-copilot-lightblue/60"
            size={80}
            animate
          />
          <p className=" text-primary-700 dark:text-copilot-lightblue/60 font-mono mb-24">
            What can I help you build?
          </p>
        </div>
      )}
    </div>
  );
}
