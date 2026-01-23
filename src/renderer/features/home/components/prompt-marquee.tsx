import { Button } from "@/components/ui/button";

export default function PromptMarquee({
  prompts,
  onSelect,
}: PromptMarqueeProps) {
  return (
    <div
      className="w-full marquee-container marquee-fade min-h-12"
      role="region"
      aria-label="Prompt suggestions"
    >
      <div className="marquee-track gap-3">
        {prompts.map((item, idx) => (
          <PromptButton
            key={`${item.label}-${idx}`}
            item={item}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function PromptButton({ item, onSelect }: PromptButtonProps) {
  return (
    <Button
      type="button"
      onClick={() => onSelect(item.label)}
      className="rounded-2xl active:scale-[0.97] bg-primary-50/70 dark:bg-primary-900/40 border-primary-200/50  
      backdrop-blur px-2 py-2 text-[14px] text-left transition inline-flex items-center gap-2 whitespace-nowrap 
      cursor-pointer hover:bg-primary-100/50 dark:hover:bg-primary-800/50"
      aria-label={`Use prompt: ${item.label}`}
    >
      <PromptIcon item={item} />
      <span>{item.label}</span>
    </Button>
  );
}

function PromptIcon({ item }: PromptIconProps) {
  return (
    <img
      src={item.imageSrc!}
      alt=""
      width={512}
      height={512}
      className="w-8 h-8 rounded"
    />
  );
}

export type PromptItem = { label: string; imageSrc: string };
interface PromptMarqueeProps {
  prompts: PromptItem[];
  onSelect: (label: string) => void;
}

interface PromptButtonProps {
  item: PromptItem;
  onSelect: (label: string) => void;
}

interface PromptIconProps {
  item: PromptItem;
}
