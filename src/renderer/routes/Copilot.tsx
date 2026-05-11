import { WorkspaceProviderPage } from "@/features/workspace/components/workspace-provider-page";
import { PROVIDER_IDS } from "../../main/modules/providers/provider-ids";

export default function CopilotPage() {
  return (
    <WorkspaceProviderPage
      providerId={PROVIDER_IDS.copilot}
      variant="copilot"
      planExitConfig={{
        key: "permissionMode",
        planValue: "plan",
        nextValue: "acceptEdits",
      }}
    />
  );
}
