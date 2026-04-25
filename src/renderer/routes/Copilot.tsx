import { WorkspaceProviderPage } from "@/features/workspace/components/workspace-provider-page";

const COPILOT_CLI_PROVIDER_ID = "copilot_cli";

export default function CopilotPage() {
  return (
    <WorkspaceProviderPage
      providerId={COPILOT_CLI_PROVIDER_ID}
      variant="copilot"
      planExitConfig={{
        key: "permissionMode",
        planValue: "plan",
        nextValue: "acceptEdits",
      }}
    />
  );
}
