import { useEffect } from "react";
import { useBrowserPanel } from "@/hooks/use-browser-panel";
import CodexPlugins from "@/features/settings/components/codex-plugins";
import { Heading3 } from "@/components/ui";
import { PageShell } from "@/components/layout/page-shell";

export default function PluginsPage() {
  const { close: closeBrowserPanel } = useBrowserPanel();

  useEffect(() => {
    closeBrowserPanel();
  }, [closeBrowserPanel]);

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6">
        <Heading3>Plugins</Heading3>
      </div>

      <CodexPlugins />
    </PageShell>
  );
}
