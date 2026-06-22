import { Body } from "@/components/ui";
import { PULSE_CATEGORIES, PULSE_TEMPLATES, type PulseTemplate } from "../templates";

export function PulseTemplates({
  onSelect,
}: {
  onSelect: (template: PulseTemplate) => void;
}) {
  return (
    <div className="space-y-8">
      {PULSE_CATEGORIES.map((cat) => {
        const items = PULSE_TEMPLATES.filter((t) => t.category === cat.id);
        if (items.length === 0) return null;
        return (
          <section key={cat.id}>
            <Body className=" font-medium mb-3">
              {cat.label}
            </Body>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8">
              {items.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-3xl glass-morphism px-4 py-4 cursor-pointer hover:bg-primary-200/60 dark:hover:bg-primary/5 transition-colors flex items-center gap-3"
                  onClick={() => onSelect(tpl)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect(tpl);
                  }}
                >
                  <div className="size-10 rounded-2xl flex items-center justify-center text-xl bg-primary-200/60 dark:bg-primary-800/60 shrink-0">
                    {tpl.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary-900 dark:text-primary-100 truncate mb-1">
                      {tpl.title}
                    </div>
                    <div className="text-xs text-primary-500 dark:text-primary-400 line-clamp-2">
                      {tpl.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
