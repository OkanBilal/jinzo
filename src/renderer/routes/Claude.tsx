import { WorkspaceProviderPage } from "@/features/workspace/components/workspace-provider-page";
import { PROVIDER_IDS } from "../../shared/provider-ids";

export default function ClaudePage() {
  return (
    <WorkspaceProviderPage
      providerId={PROVIDER_IDS.claude}
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
