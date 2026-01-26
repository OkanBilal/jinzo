import { QuickActionButton } from "./quick-action-button";

interface WorkspaceQuickActionsProps {
  onSetGoal: (goal: string) => void;
}

export function WorkspaceQuickActions({ onSetGoal }: WorkspaceQuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-200 mx-auto mb-4">
      <QuickActionButton
        label="Run security audit"
        onClick={() => onSetGoal("Run a security audit on this project")}
      />
      <QuickActionButton
        label="Improve README.md"
        onClick={() => onSetGoal("Improve the README.md file")}
      />
      <QuickActionButton
        label="Solve a TODO"
        onClick={() => onSetGoal("Find and solve a TODO comment in the codebase")}
      />
      <QuickActionButton
        label="Add logging"
        onClick={() => onSetGoal("Add logging to the codebase")}
      />
      <QuickActionButton
        label="Write tests"
        onClick={() => onSetGoal("Write unit tests for the main functionality")}
        hasArrow
      />
    </div>
  );
}
