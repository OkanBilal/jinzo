import { WorkspaceProviderPage } from "@/features/workspace/components/workspace-provider-page";

const CURSOR_PROVIDER_ID = "cursor";

export default function CursorPage() {
  return (
    <WorkspaceProviderPage
      providerId={CURSOR_PROVIDER_ID}
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
