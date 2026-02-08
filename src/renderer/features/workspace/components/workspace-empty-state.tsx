import {
  Copilot as CopilotIcon,
  Claude as ClaudeIcon,
} from "@/components/ui/icons/mood";
import type { Workspace } from "../types";
import { useClaudeAnimation } from "../hooks/use-claude-animation";
import { useRouteType } from "@/hooks/use-route-type";

interface WorkspaceEmptyStateProps {
  workspace: Workspace | null;
}
// TODO: Refactor animation code into a separate component
export function WorkspaceEmptyState({ workspace }: WorkspaceEmptyStateProps) {
  const routeType = useRouteType();
  const isClaudeRoute = routeType === "claude";
  const { symbol, word } = useClaudeAnimation(isClaudeRoute);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {isClaudeRoute ? (
        <>
          {/* <ClaudeIcon
            className="mb-2 text-primary-300 dark:text-primary-800"
            size={80}
            animate
          />
          <p className=" font-medium text-primary-300 dark:text-primary-800 mb-2 font-mono tracking-tight">
            Hi! How can I help you today?
          </p> */}
          <div className="flex items-center gap-2 font-medium font-mono tracking-tight">
            <span
              id="symbol"
              className="text-primary-700 dark:text-[#da9779] text-2xl leading-6 h-6 text-center"
            >
              {symbol}
            </span>
            <span
              id="word"
              className="text-primary-700 dark:text-[#da9779] text-2xl leading-6 h-6 "
            >
              {word}…
            </span>
          </div>
        </>
      ) : (
        <div className="mt-12 flex flex-col items-center">
          <CopilotIcon
            className="mb-2 text-primary-700 dark:text-copilot-lightblue/20"
            size={80}
            animate
          />
          <p className=" font-medium text-primary-700 dark:text-copilot-lightblue/20  mb-2 font-mono tracking-tight">
            What can I help you build?
          </p>
        </div>
      )}
    </div>
  );
}
