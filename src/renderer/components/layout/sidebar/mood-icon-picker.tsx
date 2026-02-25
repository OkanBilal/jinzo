import { useRef } from "react";
import { EmojiPicker } from "frimousse";
import { useClickOutside } from "@/hooks/use-click-outside";
import { availableIcons } from "@/lib/icon-registry";
import { Button } from "@/components/ui/button";
import { Close, SelectOption } from "@/components/ui/icons";
import Select from "@/components/ui/select";

function CurrentIcon({
  icon,
  iconMode,
}: {
  icon: string;
  iconMode: "emoji" | "icon";
}) {
  if (!icon) return null;
  const IconComp = availableIcons.find((i) => i.name === icon)?.component;
  if (IconComp) return <IconComp className="size-5" />;
  return <span>{icon}</span>;
}

type IconPickerMode = "emoji" | "icon";

interface MoodIconPickerProps {
  icon: string;
  iconMode: IconPickerMode;
  isOpen: boolean;
  previewBackground?: string;
  useFixedBackground?: boolean;
  onToggle: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectIcon: (name: string) => void;
  onSwitchMode: (mode: IconPickerMode) => void;
  onClose: () => void;
  onClear?: () => void;
}

export default function MoodIconPicker({
  icon,
  iconMode,
  isOpen,
  previewBackground,
  useFixedBackground = false,
  onToggle,
  onSelectEmoji,
  onSelectIcon,
  onSwitchMode,
  onClose,
  onClear,
}: MoodIconPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  const fixedBackgroundClass = useFixedBackground
    ? "bg-linear-to-b from-primary to-primary-50 dark:from-primary-900 dark:to-primary-950"
    : "";
  const backgroundStyle = useFixedBackground
    ? undefined
    : { background: previewBackground };

  useClickOutside(pickerRef, () => {
    if (isOpen) onClose();
  });

  return (
    <div ref={pickerRef} className="relative">
      <Button
        type="button"
        onClick={onToggle}
        className={`
          w-full px-3 py-3
          bg-primary-950/5 dark:bg-primary/4 border border-primary-950/10 dark:border-primary/10
          text-primary-800 dark:text-primary
          text-sm focus:outline-none cursor-pointer
          flex items-center justify-between
          transition-all
          ${
            isOpen
              ? "rounded-t-xl shadow-lg"
              : "rounded-xl hover:bg-primary-950/8 dark:hover:bg-primary/6"
          }
        `}
      >
        <div className="flex items-center gap-2 min-w-60">
          {onClear && icon ? (
            <span className="group/icon relative flex items-center justify-center size-5">
              <span className="group-hover/icon:opacity-0 transition-opacity">
                <CurrentIcon icon={icon} iconMode={iconMode} />
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onClear();
                  }
                }}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/icon:opacity-100 transition-opacity cursor-pointer"
              >
                <Close className="size-3 text-primary-500 dark:text-primary-400" />
              </span>
            </span>
          ) : (
            <CurrentIcon icon={icon} iconMode={iconMode} />
          )}
          <span>{icon ? "Change Icon" : "Choose an Icon"}</span>
        </div>
        <SelectOption
          className={`size-3 text-primary-900 dark:text-primary-400`}
        />
      </Button>

      {isOpen && (
        <div
          className={`absolute top-full left-0 right-0 z-50
            border border-t-0 border-primary-950/10 dark:border-primary/10
            rounded-b-xl shadow-lg overflow-hidden
            animate-dropdown-in ${fixedBackgroundClass}`}
          style={backgroundStyle}
        >
          <div className="flex border-b border-primary-950/10 dark:border-primary/10">
            <Button
              type="button"
              onClick={() => onSwitchMode("emoji")}
              className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
                iconMode === "emoji"
                  ? "text-primary-900 dark:text-primary bg-primary-950/5 dark:bg-primary/10"
                  : "text-primary-700 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-100"
              }`}
            >
              Emoji
            </Button>
            <Button
              type="button"
              onClick={() => onSwitchMode("icon")}
              className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
                iconMode === "icon"
                  ? "text-primary-900 dark:text-primary bg-primary-950/5 dark:bg-primary/10"
                  : "text-primary-700 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-100"
              }`}
            >
              Icon
            </Button>
          </div>

          <div className="p-3">
            {iconMode === "emoji" ? (
              <EmojiPicker.Root
                onEmojiSelect={(emoji) => onSelectEmoji(emoji.emoji)}
              >
                <EmojiPicker.Search
                  placeholder="Search emoji..."
                  className="w-full mb-2 px-2 py-1.5 dark:placeholder:text-primary-200 placeholder:text-primary-700 bg-primary-950/5 dark:bg-primary/10 rounded-xl text-sm outline-none focus:bg-primary-950/8 dark:focus:bg-primary/15 border border-primary-950/10 dark:border-primary/10"
                />
                <EmojiPicker.Viewport className="h-64 overflow-y-auto w-full noscrollbar">
                  <EmojiPicker.Loading>
                    <div className="flex items-center justify-center py-8 text-sm text-primary-500 dark:text-primary-400">
                      Loading emojis...
                    </div>
                  </EmojiPicker.Loading>
                  <EmojiPicker.Empty>
                    <div className="flex items-center justify-center py-8 text-sm text-primary-500 dark:text-primary-400">
                      No emoji found.
                    </div>
                  </EmojiPicker.Empty>
                  <EmojiPicker.List
                    className="select-none pb-1.5"
                    components={{
                      CategoryHeader: ({ ...props }) => (
                        <div
                          className="px-2 pt-0 pb-1.5 font-medium text-primary-600 dark:text-primary-400 text-xs"
                          style={backgroundStyle}
                          {...props}
                        >
                          {/* {category.label} */}
                        </div>
                      ),
                      Row: ({ children, ...props }) => (
                        <div className="scroll-my-1.5 px-1" {...props}>
                          {children}
                        </div>
                      ),
                      Emoji: ({ emoji, ...props }) => (
                        <Button
                          className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-primary-950/5 dark:hover:bg-primary/10 data-active:bg-primary-950/8 dark:data-active:bg-primary/15"
                          {...props}
                        >
                          {emoji.emoji}
                        </Button>
                      ),
                    }}
                  />
                </EmojiPicker.Viewport>
              </EmojiPicker.Root>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {availableIcons.map(({ name, component: IconComp }) => (
                  <Button
                    key={name}
                    type="button"
                    onClick={() => onSelectIcon(name)}
                    className={`flex items-center justify-center size-8 rounded-lg transition-all cursor-pointer ${
                      icon === name
                        ? "bg-primary-950/15 dark:bg-primary/20 text-primary-700 dark:text-primary"
                        : "hover:bg-primary-950/8 dark:hover:bg-primary/10 text-primary-700 dark:text-primary-200"
                    }`}
                    title={name}
                  >
                    <IconComp className="size-5.5" />
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
