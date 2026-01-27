import { ClaudeEmptyState } from "@/features/claude/components/claude-empty-state";

export default function ClaudePage() {


  return (
    <div className="flex flex-col h-full bg-[#0d0907] ">
      <ClaudeEmptyState />
    </div>
  );
}
