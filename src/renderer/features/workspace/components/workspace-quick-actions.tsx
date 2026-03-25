import { Task, Security, Test } from "@/components/ui/icons";
import { QuickActionButton } from "./quick-action-button";
import { useGetProviderByIdQuery } from "@/lib/redux/api";
import { Claude } from "@/components/ui/icons/space";

interface WorkspaceQuickActionsProps {
  onSetGoal: (goal: string) => void;
  projectId?: string;
  providerId: string;
}

export function WorkspaceQuickActions({
  onSetGoal,
  providerId,
}: WorkspaceQuickActionsProps) {
  const { data: provider } = useGetProviderByIdQuery(providerId);

  if ((provider?.config as any)?.showQuickActions === false) return null;

  return (
    <div className="flex flex-wrap gap-3 justify-center max-w-200 mx-auto mb-2">
      <QuickActionButton
        icon={<Task className="size-3.5" />}
        label="Fix TODOs in code"
        onClick={() =>
          onSetGoal(
            "Find and fix TODO comments in the codebase by either implementing the missing functionality or removing the TODO if it's no longer relevant",
          )
        }
      />
      <QuickActionButton
        icon={<Claude className="size-3.5" />}
        label="Update CLAUDE.md file"
        onClick={() =>
          onSetGoal(
            "Update the CLAUDE.md file with the latest workspace information",
          )
        }
      />
      <QuickActionButton
        icon={<Test className="size-3.5" />}
        label="Write tests for changes"
        onClick={() =>
          onSetGoal(
            "Look at recent git changes and write unit tests for the modified code",
          )
        }
      />
      <QuickActionButton
        icon={<Security className="size-3.5" />}
        label="Find security issues"
        onClick={() =>
          onSetGoal(
            "Scan the codebase for common security vulnerabilities and suggest fixes for any issues found",
          )
        }
      />
    </div>
  );
}
