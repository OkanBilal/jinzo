import { WorkspaceProviderPage } from "@/features/workspace/components/workspace-provider-page";
import { useSpaceProviderVariant } from "@/hooks/use-space-provider-variant";
import { useActiveSpace } from "@/hooks/use-active-space";

/**
 * Unified agent workspace route — hosts every provider. Which provider it
 * drives comes from the active space (`uiConfig.providerId`); switching space
 * remounts the page via `key` so no per-run UI state leaks across providers.
 *
 * Renders nothing until the space queries resolve: provider resolution is
 * async, and mounting with the claude fallback would fire wrong-provider
 * queries and immediately remount once the real space arrives.
 */
export default function CodePage() {
  const { isLoaded } = useActiveSpace();
  const provider = useSpaceProviderVariant();

  if (!isLoaded) return null;

  return (
    <WorkspaceProviderPage
      key={provider.providerId}
      providerId={provider.providerId}
      variant={provider.variant}
    />
  );
}
