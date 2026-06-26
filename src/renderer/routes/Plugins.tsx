import { useEffect } from "react";
import { useBrowserPanel } from "@/hooks/use-browser-panel";
import ProviderPlugins from "@/features/settings/components/provider-plugins";
import { Heading3, Muted } from "@/components/ui";
import { PageShell } from "@/components/layout/page-shell";
import { useActiveSpace } from "@/hooks/use-active-space";
import { PROVIDER_IDS } from "../../shared/provider-ids";

// Agent slugs whose driver implements the plugin API. Copilot/Cursor don't.
const PLUGIN_PROVIDER_BY_SLUG: Record<string, string> = {
  claude: PROVIDER_IDS.claude,
  codex: PROVIDER_IDS.codex,
};

export default function PluginsPage() {
  const { close: closeBrowserPanel } = useBrowserPanel();
  const { activeSpaceAgentSlug } = useActiveSpace();

  useEffect(() => {
    closeBrowserPanel();
  }, [closeBrowserPanel]);

  const providerId = activeSpaceAgentSlug
    ? PLUGIN_PROVIDER_BY_SLUG[activeSpaceAgentSlug]
    : undefined;

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6">
        <Heading3>Plugins</Heading3>
      </div>

      {providerId ? (
        <ProviderPlugins providerId={providerId} />
      ) : (
        <Muted>Plugins aren&apos;t available for this agent yet.</Muted>
      )}
    </PageShell>
  );
}
