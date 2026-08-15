import { Body, Text } from "@/components/ui";
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
            <Body weight="medium" className="mb-3">
              {cat.label}
            </Body>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8">
              {items.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-3xl glass-surface px-4 py-6 cursor-pointer transition-colors flex items-center gap-3"
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
                    <Text as="div" weight="medium" className="truncate mb-1">
                      {tpl.title}
                    </Text>
                    <Text as="div" size="xs" tone="subtle" className="line-clamp-2">
                      {tpl.description}
                    </Text>
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
