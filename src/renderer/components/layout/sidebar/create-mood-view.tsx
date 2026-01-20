import { useState, useEffect, useRef } from "react";
import Text, { Heading3 } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { useCreateMoodMutation, useSetActiveMoodMutation } from "@/lib/redux/api";
import { toast } from "sonner";
import { EmojiPicker } from "frimousse";
import { useClickOutside } from "@/features/chat/hooks/use-click-outside";
import { useDarkMode } from "@/hooks/useDarkMode";
import {
  solidColors,
  gradientColors,
  getThemeVariant,
} from "@/lib/config/mood-themes";
import { availableIcons } from "@/lib/icon-registry";

type IconPickerMode = "emoji" | "icon";

interface CreateMoodViewProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateMoodView({
  onClose,
  onSuccess,
}: CreateMoodViewProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [iconMode, setIconMode] = useState<IconPickerMode>("emoji");
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [showGradients, setShowGradients] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const originalBackgroundColor = useRef<string>("");

  const [createMood, { isLoading }] = useCreateMoodMutation();
  const [setActiveMood] = useSetActiveMoodMutation();
  const { darkMode } = useDarkMode();

  // Save original background color on mount
  useEffect(() => {
    const appRoot = document.querySelector(".app-root") as HTMLElement;
    if (appRoot) {
      originalBackgroundColor.current = appRoot.style.backgroundColor || "";
    }

    // Restore original color on unmount (if user cancels)
    return () => {
      if (appRoot) {
        if (originalBackgroundColor.current) {
          appRoot.style.backgroundColor = originalBackgroundColor.current;
        }
        // Remove preview CSS custom property
        appRoot.style.removeProperty('--mood-preview-bg');
      }
    };
  }, []);

  useClickOutside(emojiPickerRef, () => {
    if (isEmojiPickerOpen) setIsEmojiPickerOpen(false);
  });

  const handlePresetColor = (index: number) => {
    setSelectedColorIndex(index);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a mood name");
      return;
    }

    try {
      // Store both light and dark variants
      const themeConfig = JSON.stringify({
        lightBackground: selectedColorPair.light.value,
        darkBackground: selectedColorPair.dark.value,
      });
      
      // Add prefix based on icon mode
      const iconValue = icon 
        ? (iconMode === "icon" ? `icon:${icon}` : `emoji:${icon}`)
        : "emoji:😊";
      
      const result = await createMood({
        name: name.trim(),
        icon: iconValue,
        themeConfig,
        systemPrompt: systemPrompt.trim() || undefined,
      }).unwrap();

      // Switch to the newly created mood
      if (result?.id) {
        await setActiveMood(result.id).unwrap();
      }

      // Clear the original color ref so cleanup doesn't restore it
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

  // Get current color based on app theme
  const selectedColorPair = currentColors[selectedColorIndex] || solidColors[0];
  const currentVariant = getThemeVariant(selectedColorPair, darkMode);
  const backgroundColor = currentVariant.value;

  // Text colors based on app dark mode
  const textPrimary = darkMode ? "text-primary" : "text-primary-800";
  const textMuted = darkMode ? "text-primary-400" : "text-primary-500";

  // Apply live preview when color changes
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
      
      // Set CSS custom property for dropdown backgrounds
      // Remove opacity for solid colors
      const dropdownBg = currentVariant.preview;
      appRoot.style.setProperty('--mood-preview-bg', dropdownBg);
    }
  }, [backgroundColor, currentVariant.preview]);

  return (
    <div
      className="flex flex-col h-full"
      style={{ animation: "fadeIn 300ms ease-in-out" }}
    >
      <div className="flex flex-col items-center pt-8 pb-6 px-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-3xl mb-2 "
          style={{
            background: currentVariant.preview,
          }}
        >
          {iconMode === "icon" && icon ? (
            (() => {
              const IconComp = availableIcons.find(i => i.name === icon)?.component;
              return IconComp ? <IconComp className="size-7 text-primary-800 dark:text-primary" /> : "";
            })()
          ) : (
            icon || ""
          )}
        </div>
        <Heading3 className="text-center text-primary-800 dark:text-primary">
          {name || "Create Mood"}{" "}
        </Heading3>
      </div>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto noscrollbar">
        <div className="relative">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            autoFocus
          />
        </div>

        <div ref={emojiPickerRef} className="relative">
          {/* Trigger Button - Select component style */}
          <button
            type="button"
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
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
                  const IconComp = availableIcons.find(i => i.name === icon)?.component;
                  return IconComp ? <IconComp className="size-5" /> : <span>📦</span>;
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
          </button>

          {/* Icon/Emoji Picker Dropdown */}
          {isEmojiPickerOpen && (
            <div
              className="absolute top-full left-0 right-0 z-50 
                border border-t-0 border-primary-950/10 dark:border-primary/10 
                rounded-b-xl shadow-lg overflow-hidden
                animate-slideDown"
              style={{
                background: currentVariant.preview,
              }}
            >
              {/* Mode Toggle */}
              <div className="flex border-b border-primary-950/10 dark:border-primary/10">
                <button
                  type="button"
                  onClick={() => {
                    setIconMode("emoji");
                    setIcon("");
                  }}
                  className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    iconMode === "emoji"
                      ? "text-primary-700 dark:text-primary bg-primary-950/5 dark:bg-primary/10"
                      : "text-primary-400 dark:text-primary-500 hover:text-primary-600 dark:hover:text-primary-300"
                  }`}
                >
                  Emoji
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIconMode("icon");
                    setIcon("");
                  }}
                  className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    iconMode === "icon"
                      ? "text-primary-700 dark:text-primary bg-primary-950/5 dark:bg-primary/10"
                      : "text-primary-400 dark:text-primary-500 hover:text-primary-600 dark:hover:text-primary-300"
                  }`}
                >
                  Icon
                </button>
              </div>

              <div className="p-3">
                {iconMode === "emoji" ? (
                  <EmojiPicker.Root
                    onEmojiSelect={(emoji) => {
                      setIcon(emoji.emoji);
                      setIsEmojiPickerOpen(false);
                    }}
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
                          CategoryHeader: ({ category, ...props }) => (
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
                            <button
                              className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-primary-950/5 dark:hover:bg-primary/10 data-active:bg-primary-950/8 dark:data-active:bg-primary/15"
                              {...props}
                            >
                              {emoji.emoji}
                            </button>
                          ),
                        }}
                      />
                    </EmojiPicker.Viewport>
                  </EmojiPicker.Root>
                ) : (
                  /* Icon Grid */
                  <div className="grid grid-cols-5 gap-2">
                    {availableIcons.map(({ name, component: IconComp }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setIcon(name);
                          setIsEmojiPickerOpen(false);
                        }}
                        className={`flex items-center justify-center size-8 rounded-lg transition-all cursor-pointer ${
                          icon === name
                            ? "bg-primary-950/15 dark:bg-primary/20 text-primary-700 dark:text-primary"
                            : "hover:bg-primary-950/8 dark:hover:bg-primary/10 text-primary-500 dark:text-primary-400"
                        }`}
                        title={name}
                      >
                        <IconComp className="size-5.5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* System Prompt */}
        <div className="space-y-2">
          <Text className="text-xs text-primary-500 dark:text-primary-400">
            System Prompt
          </Text>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
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
          className="rounded-xl overflow-hidden
            bg-primary-950/5 dark:bg-primary/4
            shadow-[inset_0_0.5px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]"
        >
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: showGradients ? "translateX(-100%)" : "translateX(0)" }}
          >
            {/* Solid Colors Row */}
            <div className="flex items-center gap-2 px-4 py-3 ml-2 min-w-full">
              {solidColors.map((colorPair, index) => {
                const variant = getThemeVariant(colorPair, darkMode);
                return (
                  <button
                    key={`solid-${index}`}
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
                          ? "ring-2 ring-primary ring-offset-1 ring-offset-primary-900 scale-110"
                          : "hover:scale-110"
                      }
                    `}
                    style={{ background: variant.preview }}
                    title={colorPair.name}
                  />
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setShowGradients(true);
                  setSelectedColorIndex(0);
                }}
                className="ml-auto shrink-0 p-1 mr-1 rounded-lg hover:bg-primary-950/10 dark:hover:bg-primary/10 transition-colors cursor-pointer"
                title="Show Gradients"
              >
                <svg
                  className="w-4 h-4 text-primary-500 dark:text-primary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* Gradient Colors Row */}
            <div className="flex items-center gap-2 px-4 mr-2 py-3 min-w-full">
              <button
                type="button"
                onClick={() => {
                  setShowGradients(false);
                  setSelectedColorIndex(0);
                }}
                className="shrink-0 p-1 -ml-2 mr-1 rounded-lg hover:bg-primary-950/10 dark:hover:bg-primary/10 transition-colors cursor-pointer"
                title="Show Solid Colors"
              >
                <svg
                  className="w-4 h-4 text-primary-500 dark:text-primary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              {gradientColors.map((colorPair, index) => {
                const variant = getThemeVariant(colorPair, darkMode);
                return (
                  <button
                    key={`gradient-${index}`}
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
                          ? "ring-2 ring-primary ring-offset-1 ring-offset-primary-900 scale-110"
                          : "hover:scale-110"
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

      {/* Footer Actions */}
      <div className="p-4 space-y-2">
        <button
          onClick={handleCreate}
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 
          disabled:cursor-not-allowed brightness-120 hover:scale-[1.02] active:scale-[0.98] text-primary-800 dark:text-primary"
          style={{
            background: currentVariant.preview,
          }}
        >
          {isLoading ? "Creating..." : "Create Mood"}
        </button>
        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
