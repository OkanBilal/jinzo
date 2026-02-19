import { useReducer, useEffect, useRef } from "react";
import Text, { Heading3 } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import {
  useCreateMoodMutation,
  useSetActiveMoodMutation,
} from "@/lib/redux/api";
import { toast } from "@/components/ui/toast";
import { EmojiPicker } from "frimousse";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  solidColors,
  gradientColors,
  getThemeVariant,
} from "@/lib/mood-themes";
import { availableIcons } from "@/lib/icon-registry";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "@/components/ui/icons";

type IconPickerMode = "emoji" | "icon";

interface CreateMoodFormState {
  name: string;
  icon: string;
  iconMode: IconPickerMode;
  selectedColorIndex: number;
  isEmojiPickerOpen: boolean;
  showGradients: boolean;
  systemPrompt: string;
}

const mergeState = (prev: CreateMoodFormState, next: Partial<CreateMoodFormState>): CreateMoodFormState => ({
  ...prev,
  ...next,
});

interface CreateMoodViewProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateMoodView({
  onClose,
  onSuccess,
}: CreateMoodViewProps) {
  const [state, updateState] = useReducer(mergeState, {
    name: "",
    icon: "",
    iconMode: "emoji" as IconPickerMode,
    selectedColorIndex: 0,
    isEmojiPickerOpen: false,
    showGradients: false,
    systemPrompt: "",
  });
  const { name, icon, iconMode, selectedColorIndex, isEmojiPickerOpen, showGradients, systemPrompt } = state;

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const originalBackgroundColor = useRef<string>("");

  const [createMood, { isLoading }] = useCreateMoodMutation();
  const [setActiveMood] = useSetActiveMoodMutation();
  const { darkMode } = useDarkMode();

  useEffect(() => {
    const appRoot = document.querySelector(".app-root") as HTMLElement;
    if (appRoot) {
      originalBackgroundColor.current = appRoot.style.backgroundColor || "";
    }
    return () => {
      if (appRoot) {
        if (originalBackgroundColor.current) {
          appRoot.style.backgroundColor = originalBackgroundColor.current;
        }
        // Remove preview CSS custom property
        appRoot.style.removeProperty("--mood-preview-bg");
      }
    };
  }, []);

  useClickOutside(emojiPickerRef, () => {
    if (isEmojiPickerOpen) updateState({ isEmojiPickerOpen: false });
  });

  const handlePresetColor = (index: number) => {
    updateState({ selectedColorIndex: index });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a mood name");
      return;
    }

    try {
      const themeConfig = JSON.stringify({
        lightBackground: selectedColorPair.light.value,
        darkBackground: selectedColorPair.dark.value,
      });

      const iconValue = icon
        ? iconMode === "icon"
          ? `icon:${icon}`
          : `emoji:${icon}`
        : "emoji:😊";

      const result = await createMood({
        name: name.trim(),
        icon: iconValue,
        themeConfig,
        systemPrompt: systemPrompt.trim() || undefined,
      }).unwrap();

      if (result?.id) {
        await setActiveMood(result.id).unwrap();
      }

      originalBackgroundColor.current = "";

      toast.success("Mood created!");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error creating mood:", error);
      toast.error("Failed to create mood");
    }
  };

  const currentColors = showGradients ? gradientColors : solidColors;

  const selectedColorPair = currentColors[selectedColorIndex] || solidColors[0];
  const currentVariant = getThemeVariant(selectedColorPair, darkMode);
  const backgroundColor = currentVariant.value;

  useEffect(() => {
    const appRoot = document.querySelector(".app-root") as HTMLElement;
    if (appRoot) {
      if (backgroundColor.startsWith("linear-gradient")) {
        appRoot.style.backgroundColor = "transparent";
        appRoot.style.background = backgroundColor;
      } else {
        appRoot.style.background = "none";
        appRoot.style.backgroundColor = backgroundColor;
      }

      const dropdownBg = currentVariant.preview;
      appRoot.style.setProperty("--mood-preview-bg", dropdownBg);
    }
  }, [backgroundColor, currentVariant.preview]);

  return (
    <div
      className="flex flex-col h-full"
      style={{ animation: "slide-fade-down 300ms ease-in-out" }}
    >
      <div className="flex flex-col items-center pt-8 pb-6 px-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-3xl mb-2 "
          style={{
            background: currentVariant.preview,
          }}
        >
          {iconMode === "icon" && icon
            ? (() => {
                const IconComp = availableIcons.find(
                  (i) => i.name === icon,
                )?.component;
                return IconComp ? (
                  <IconComp className="size-7 text-primary-800 dark:text-primary" />
                ) : (
                  ""
                );
              })()
            : icon || ""}
        </div>
        <Heading3 className="text-center text-primary-800 dark:text-primary">
          {name || "Create Mood"}{" "}
        </Heading3>
      </div>

      <div className="flex-1 px-3 space-y-4 overflow-y-auto noscrollbar">
        <div className="relative">
          <Input
            type="text"
            value={name}
            onChange={(e) => updateState({ name: e.target.value })}
            placeholder="Mood name..."
            className="w-full px-3 py-2 border-0! shadow-none!
              bg-primary-950/10! dark:bg-primary/4
              dark:placeholder:text-primary-100!
              placeholder:text-primary-700!
              text-primary-800 dark:text-primary
              text-sm focus:outline-none
              flex items-center justify-between
              transition-all
            "
          />
        </div>

        <div ref={emojiPickerRef} className="relative">
          {/* Trigger Button - Select component style */}
          <Button
            type="button"
            onClick={() => updateState({ isEmojiPickerOpen: !isEmojiPickerOpen })}
            className={`
              w-full px-3 py-2 
              bg-primary-950/5 dark:bg-primary/4 border-primary-950/10 dark:border-primary/10
              text-primary-800 dark:text-primary
              text-sm focus:outline-none cursor-pointer 
              flex items-center justify-between 
              transition-all
              ${
                isEmojiPickerOpen
                  ? "rounded-t-xl shadow-lg"
                  : "rounded-xl hover:bg-primary-950/8 dark:hover:bg-primary/6"
              }
            `}
          >
            <div className="flex items-center gap-2">
              {iconMode === "icon" && icon ? (
                (() => {
                  const IconComp = availableIcons.find(
                    (i) => i.name === icon,
                  )?.component;
                  return IconComp ? (
                    <IconComp className="size-5" />
                  ) : (
                    <span>📦</span>
                  );
                })()
              ) : (
                <span>{icon || "😊"}</span>
              )}
              <span>Choose an Icon</span>
            </div>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                isEmojiPickerOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </Button>

          {isEmojiPickerOpen && (
            <div
              className="absolute top-full left-0 right-0 z-50 
                border border-t-0 border-primary-950/10 dark:border-primary/10 
                rounded-b-xl shadow-lg overflow-hidden
                animate-slide-fade-down"
              style={{
                background: currentVariant.preview,
              }}
            >
              {/* Mode Toggle */}
              <div className="flex border-b border-primary-950/10 dark:border-primary/10">
                <Button
                  type="button"
                  onClick={() => updateState({ iconMode: "emoji", icon: "" })}
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
                  onClick={() => updateState({ iconMode: "icon", icon: "" })}
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
                    onEmojiSelect={(emoji) => updateState({ icon: emoji.emoji, isEmojiPickerOpen: false })}
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
                              style={{ background: currentVariant.preview }}
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
                  /* Icon Grid */
                  <div className="grid grid-cols-5 gap-2">
                    {availableIcons.map(({ name, component: IconComp }) => (
                      <Button
                        key={name}
                        type="button"
                        onClick={() => updateState({ icon: name, isEmojiPickerOpen: false })}
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

        <div className="space-y-2">
          <Text className="text-xs text-primary-500 dark:text-primary-400">
            System Prompt
          </Text>
          <textarea
            value={systemPrompt}
            onChange={(e) => updateState({ systemPrompt: e.target.value })}
            placeholder="Enter a system prompt to customize AI behavior..."
            rows={4}
            className="w-full px-3 py-2 border-0 shadow-none resize-none
              bg-primary-950/10 dark:bg-primary/4
              placeholder:text-primary-700 dark:placeholder:text-primary-100
              text-primary-800 dark:text-primary
              text-sm focus:outline-none
              rounded-xl transition-all
              dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]"
          />
        </div>

        {/* Theme Selector - Animated Slide */}
        <div
          className="rounded-2xl overflow-hidden
            bg-primary-950/5 dark:bg-primary/4
            shadow-[inset_0_0.5px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]"
        >
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{
              transform: showGradients ? "translateX(-100%)" : "translateX(0)",
            }}
          >
            {/* Solid Colors Row */}
            <div className="flex items-center gap-2 px-3 py-2.5 ml-2 min-w-full">
              {solidColors.map((colorPair, index) => {
                const variant = getThemeVariant(colorPair, darkMode);
                return (
                  <Button
                    key={`solid-${colorPair.name}`}
                    type="button"
                    onClick={() => {
                      if (!showGradients) {
                        handlePresetColor(index);
                      }
                    }}
                    className={`
                      w-5 h-5 rounded-full transition-all duration-200 cursor-pointer shrink-0
                      ${
                        !showGradients && selectedColorIndex === index
                          ? "ring-2 ring-primary-200 scale-105"
                          : "hover:scale-101"
                      }
                    `}
                    style={{ background: variant.preview }}
                    title={colorPair.name}
                  />
                );
              })}
              <Button
                type="button"
                onClick={() => updateState({ showGradients: true, selectedColorIndex: 0 })}
                className="ml-auto shrink-0 p-0.5 mr-1 rounded-lg hover:bg-primary-950/10 dark:hover:bg-primary/10 transition-colors cursor-pointer"
                title="Show Gradients"
              >
                <ArrowUp className="w-5 h-5 text-primary-700 dark:text-primary-200 rotate-90" />
              </Button>
            </div>

            <div className="flex items-center gap-2 px-3 mr-2  min-w-full">
              <Button
                type="button"
                onClick={() => updateState({ showGradients: false, selectedColorIndex: 0 })}
                className="shrink-0 -ml-4 mr-1 rounded-lg p-0.5 hover:bg-primary-950/10 dark:hover:bg-primary/10 transition-colors cursor-pointer"
                title="Show Solid Colors"
              >
                <ArrowUp className="w-5 h-5 text-primary-700 dark:text-primary-200 rotate-270" />
              </Button>
              {gradientColors.map((colorPair, index) => {
                const variant = getThemeVariant(colorPair, darkMode);
                return (
                  <Button
                    key={`gradient-${colorPair.name}`}
                    type="button"
                    onClick={() => {
                      if (showGradients) {
                        handlePresetColor(index);
                      }
                    }}
                    className={`
                      w-5 h-5 rounded-full transition-all duration-200 cursor-pointer shrink-0
                      ${
                        showGradients && selectedColorIndex === index
                          ? "ring-2 ring-primary-200 scale-105"
                          : "hover:scale-101"
                      }
                    `}
                    style={{ background: variant.preview }}
                    title={colorPair.name}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <Button
          onClick={handleCreate}
          disabled={isLoading}
          className="w-full py-2.5 px-3 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 
          disabled:cursor-not-allowed brightness-120 hover:scale-101 active:scale-99 text-primary-800 dark:text-primary"
          style={{
            background: currentVariant.preview,
          }}
        >
          {isLoading ? "Creating..." : "Create Mood"}
        </Button>
        <Button
          onClick={onClose}
          className="w-full py-2 text-sm font-medium text-primary-900 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 transition-colors cursor-pointer"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
