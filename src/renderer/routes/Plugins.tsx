import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const tabRowRef = useRef<HTMLDivElement>(null);
  const tabBtnRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    plugins: null,
    skills: null,
  });
  const [pill, setPill] = useState({ left: 0, width: 0 });

  const syncPill = useCallback(() => {
    const row = tabRowRef.current;
    const btn = tabBtnRefs.current[activeTab];
    if (!row || !btn) return;
    setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [activeTab]);

  useLayoutEffect(() => {
    syncPill();
  }, [syncPill]);

  useEffect(() => {
    const row = tabRowRef.current;
    if (!row) return;
    const ro = new ResizeObserver(() => syncPill());
    ro.observe(row);
    window.addEventListener("resize", syncPill);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncPill);
    };
  }, [syncPill]);

  useEffect(() => {
    closeBrowserPanel();
  }, [closeBrowserPanel]);

  return (
    <div className="h-full max-w-240 mx-auto px-2 pt-16 overflow-y-auto noscrollbar bg-primary dark:bg-primary-950">
      <div className="flex items-center justify-between mb-6">
        <Heading2>{activeTab === "plugins" ? "Plugins" : "Skills"}</Heading2>
        <div
          ref={tabRowRef}
          className="relative flex gap-1 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 p-1"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute top-1 bottom-1 rounded-lg bg-primary-200/80 dark:bg-primary-800/60 transition-[left,width] duration-300 ease-out"
            style={{
              left: pill.width ? pill.left : undefined,
              width: pill.width || undefined,
            }}
          />
          {TABS.map((t) => (
            <button
              key={t.value}
              ref={(el) => {
                tabBtnRefs.current[t.value] = el;
              }}
              type="button"
              onClick={() => setActiveTab(t.value)}
              className={`relative z-10 px-3 py-1 text-xs rounded-lg transition-colors duration-300 cursor-pointer ${
                activeTab === t.value
                  ? "text-primary-900 dark:text-primary-100"
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
