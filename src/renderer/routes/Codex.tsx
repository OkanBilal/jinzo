import { WorkspaceProviderPage } from "@/features/workspace/components/workspace-provider-page";
import { PROVIDER_IDS } from "../../shared/provider-ids";

export default function CodexPage() {
  return (
    <WorkspaceProviderPage
      providerId={PROVIDER_IDS.codex}
      variant="codex"
      planExitConfig={{
        key: "sandboxMode",
        planValue: "plan",
        nextValue: "workspace-write",
      }}
      enableForkRun
    />
  );
}
