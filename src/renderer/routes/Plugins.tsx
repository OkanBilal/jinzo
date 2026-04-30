import { useEffect, useState } from "react";
import { useBrowserPanel } from "@/hooks/use-browser-panel";
import CodexPlugins from "@/features/settings/components/codex-plugins";
import SkillsMarketplace from "@/features/settings/components/skills-marketplace";
import { Heading2 } from "@/components/ui";

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
    <div className="h-full max-w-240 mx-auto px-2 pt-16 overflow-y-auto noscrollbar bg-primary dark:bg-primary-950">
      <div className="flex items-center justify-between mb-6">
        <Heading2>{activeTab === "plugins" ? "Plugins" : "Skills"}</Heading2>
        <div className="flex gap-1 rounded-2xl bg-primary-100/50 dark:bg-primary-800/30 p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`px-3 py-1 text-sm rounded-xl transition-colors cursor-pointer ${
                activeTab === t.value
                  ? "bg-primary-200/80 dark:bg-primary-800/60 text-primary-900 dark:text-primary-100"
                  : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "plugins" ? <CodexPlugins /> : <SkillsMarketplace />}
    </div>
  );
}
