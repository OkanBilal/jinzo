import { WorkspaceProviderPage } from "@/features/workspace/components/workspace-provider-page";

const CODEX_PROVIDER_ID = "codex";

export default function CodexPage() {
  return (
    <WorkspaceProviderPage
      providerId={CODEX_PROVIDER_ID}
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
