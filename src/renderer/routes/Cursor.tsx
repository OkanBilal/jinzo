import { WorkspaceProviderPage } from "@/features/workspace/components/workspace-provider-page";
import { PROVIDER_IDS } from "../../main/modules/providers/provider-ids";

export default function CursorPage() {
  return (
    <WorkspaceProviderPage
      providerId={PROVIDER_IDS.cursor}
      variant="cursor"
      planExitConfig={{
        key: "mode",
        planValue: "plan",
        nextValue: "agent",
      }}
      enableSuggestions
    />
  );
}
