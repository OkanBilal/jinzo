import { useEffect, useState } from "react";
import { useBrowserPanel } from "@/hooks/use-browser-panel";
import CodexPlugins from "@/features/settings/components/codex-plugins";
import SkillsMarketplace from "@/features/settings/components/skills-marketplace";
import { Heading2, SegmentedTabs } from "@/components/ui";
import { PageShell } from "@/components/layout/page-shell";

type Tab = "plugins" | "skills";

const TABS: { value: Tab; label: string }[] = [
  { value: "plugins", label: "Plugins" },
  { value: "skills", label: "Skills" },
];

export default function PluginsPage() {
  const { close: closeBrowserPanel } = useBrowserPanel();
  const [activeTab, setActiveTab] = useState<Tab>("plugins");

  useEffect(() => {
    closeBrowserPanel();
  }, [closeBrowserPanel]);

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6">
        <Heading2>{activeTab === "plugins" ? "Plugins" : "Skills"}</Heading2>
        <SegmentedTabs value={activeTab} onChange={setActiveTab} options={TABS} />
      </div>

      {activeTab === "plugins" ? <CodexPlugins /> : <SkillsMarketplace />}
    </PageShell>
  );
}
