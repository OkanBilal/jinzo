import { WorkspaceProviderPage } from "@/features/workspace/components/workspace-provider-page";

const CLAUDE_PROVIDER_ID = "claude_code";

export default function ClaudePage() {
  return (
    <WorkspaceProviderPage
      providerId={CLAUDE_PROVIDER_ID}
      variant="claude"
      planExitConfig={{
        key: "permissionMode",
        planValue: "plan",
        nextValue: "acceptEdits",
      }}
      enableForkRun
      enableSuggestions
    />
  );
}
