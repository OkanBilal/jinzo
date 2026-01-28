import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Text, { Heading3 } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { useUpdateMoodMutation } from "@/lib/redux/api";
import type { Mood } from "@/lib/redux/api";
import { toast } from "@/components/toast";
import { EmojiPicker } from "frimousse";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  solidColors,
  gradientColors,
  getThemeVariant,
  type ThemeColor,
} from "@/lib/mood-themes";
import { availableIcons, parseIcon } from "@/lib/icon-registry";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "@/components/ui/icons";

type IconPickerMode = "emoji" | "icon";

interface EditMoodModalProps {
  isOpen: boolean;
  mood: Mood | null;
  onClose: () => void;
  onSuccess?: () => void;
  sidebarWidth?: string;
}

function parseThemeConfig(themeConfig: string | null): {
  colorIndex: number;
  isGradient: boolean;
} {
  if (!themeConfig) {
    return { colorIndex: 0, isGradient: false };
  }

  try {
    const config = JSON.parse(themeConfig);
    const darkBg = config.darkBackground || "";

    // Try to find matching color in gradients first
    for (let i = 0; i < gradientColors.length; i++) {
      if (gradientColors[i].dark.value === darkBg) {
        return { colorIndex: i, isGradient: true };
      }
    }

    // Then check solid colors
    for (let i = 0; i < solidColors.length; i++) {
      if (solidColors[i].dark.value === darkBg) {
        return { colorIndex: i, isGradient: false };
      }
    }
  } catch {
    // Ignore parse errors
  }

  return { colorIndex: 0, isGradient: false };
}

export default function EditMoodModal({
  isOpen,
  mood,
  onClose,
  onSuccess,
  sidebarWidth = "18rem",
}: EditMoodModalProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [iconMode, setIconMode] = useState<IconPickerMode>("emoji");
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [showGradients, setShowGradients] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevMoodId, setPrevMoodId] = useState<string | null>(mood?.id ?? null);

  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const [updateMood, { isLoading }] = useUpdateMoodMutation();
  const { darkMode } = useDarkMode();

  // Initialize form when mood changes (adjust state during render)
  if (mood && mood.id !== prevMoodId) {
    setPrevMoodId(mood.id);
    setName(mood.name);
    setSystemPrompt(mood.systemPrompt || "");

    // Parse icon
    const parsedIcon = parseIcon(mood.icon);
    if (parsedIcon.type === "icon") {
      setIconMode("icon");
      const iconName = mood.icon?.replace("icon:", "") || "";
      setIcon(iconName);
    } else {
      setIconMode("emoji");
      setIcon(parsedIcon.value as string);
    }

    // Parse theme config
    const { colorIndex, isGradient } = parseThemeConfig(mood.themeConfig);
    setSelectedColorIndex(colorIndex);
    setShowGradients(isGradient);
  }

  // Reset closing state when modal opens (adjust state during render)
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(isOpen);
    setIsClosing(false);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(isOpen);
  }

  // Handle animated close
  const handleAnimatedClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  useClickOutside(emojiPickerRef, () => {
    if (isEmojiPickerOpen) setIsEmojiPickerOpen(false);
  });

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isClosing) {
        handleAnimatedClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }

    return undefined;
  }, [isOpen, isClosing, handleAnimatedClose]);

  const handlePresetColor = (index: number) => {
    setSelectedColorIndex(index);
  };

  const handleSave = async () => {
    if (!mood) return;

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

      await updateMood({
        id: mood.id,
        payload: {
          name: name.trim(),
          icon: iconValue,
          themeConfig,
          systemPrompt: systemPrompt.trim() || undefined,
        },
      }).unwrap();

      toast.success("Mood updated!");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error updating mood:", error);
      toast.error("Failed to update mood");
    }
  };

  if (!isOpen || !mood) return null;

  const currentColors = showGradients ? gradientColors : solidColors;
  const selectedColorPair: ThemeColor =
    currentColors[selectedColorIndex] || solidColors[0];
  const currentVariant = getThemeVariant(selectedColorPair, darkMode);

  return createPortal(
    <div className="fixed inset-0 z-100">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        style={{ opacity: isClosing ? 0 : 1 }}
        onClick={handleAnimatedClose}
      />
      <div
        className={`absolute left-0 bottom-0 z-40 min-h-[calc(60vh-2rem)] overflow-hidden rounded-t-3xl ${isClosing ? "animate-modal-out" : "animate-modal-in"}`}
        style={{
          width: sidebarWidth,
          background: currentVariant.preview,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center pt-6 pb-4 px-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2"
            style={{ background: currentVariant.preview }}
          >
            {iconMode === "icon" && icon ? (
              (() => {
                const IconComp = availableIcons.find(
                  (i) => i.name === icon,
                )?.component;
                return IconComp ? (
                  <IconComp className="size-6 text-primary-800 dark:text-primary" />
                ) : (
                  ""
                );
              })()
            ) : (
              <span>{icon || ""}</span>
            )}
          </div>
          <Heading3 className="text-center text-primary-800 dark:text-primary">
            Edit Mood
          </Heading3>
        </div>

        {/* Content */}
        <div className="px-4 space-y-4 overflow-y-auto max-h-[50vh] noscrollbar">
          {/* Name Input */}
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
                dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]"
              autoFocus
            />
          </div>

          {/* Icon Picker */}
          <div ref={emojiPickerRef} className="relative">
            <Button
              type="button"
              onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
              className={`
                w-full px-3 py-2
                bg-primary-950/5 dark:bg-primary/4 border-primary-950/10 dark:border-primary/10
                text-primary-800 dark:text-primary
                text-sm focus:outline-none cursor-pointer
                flex items-center justify-between
                transition-all
                shadow-[inset_0_0.5px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]
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
                style={{ background: currentVariant.preview }}
              >
                {/* Mode Toggle */}
                <div className="flex border-b border-primary-950/10 dark:border-primary/10">
                  <Button
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
                  </Button>
                  <Button
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
                  </Button>
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
                      <EmojiPicker.Viewport className="h-48 overflow-y-auto w-full noscrollbar">
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
                              />
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
                    <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                      {availableIcons.map(({ name, component: IconComp }) => (
                        <Button
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
                        </Button>
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
              rows={3}
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
              style={{
                transform: showGradients
                  ? "translateX(-100%)"
                  : "translateX(0)",
              }}
            >
              {/* Solid Colors Row */}
              {/* Solid Colors Row */}
              <div className="flex items-center gap-2 px-4 py-2.5 ml-2 min-w-full">
                {solidColors.map((colorPair, index) => {
                  const variant = getThemeVariant(colorPair, darkMode);
                  return (
                    <Button
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
                          ? "ring-2 ring-primary-200 scale-105"
                          : "hover:scale-105"
                      }
                    `}
                      style={{ background: variant.preview }}
                      title={colorPair.name}
                    />
                  );
                })}
                <Button
                  type="button"
                  onClick={() => {
                    setShowGradients(true);
                    setSelectedColorIndex(0);
                  }}
                  className="ml-auto shrink-0 p-0.5 mr-1 rounded-lg hover:bg-primary-950/10 dark:hover:bg-primary/10 transition-colors cursor-pointer"
                  title="Show Gradients"
                >
                  <ArrowUp className="w-5 h-5 text-primary-700 dark:text-primary-200 rotate-90" />
                </Button>
              </div>

              <div className="flex items-center gap-2 px-4 mr-2  min-w-full">
                <Button
                  type="button"
                  onClick={() => {
                    setShowGradients(false);
                    setSelectedColorIndex(0);
                  }}
                  className="shrink-0 -ml-4 mr-1 rounded-lg p-0.5 hover:bg-primary-950/10 dark:hover:bg-primary/10 transition-colors cursor-pointer"
                  title="Show Solid Colors"
                >
                  <ArrowUp className="w-5 h-5 text-primary-700 dark:text-primary-200 rotate-270" />
                </Button>
                {gradientColors.map((colorPair, index) => {
                  const variant = getThemeVariant(colorPair, darkMode);
                  return (
                    <Button
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
                                      showGradients &&
                                      selectedColorIndex === index
                                        ? "ring-2 ring-primary-200 scale-105"
                                        : "hover:scale-105"
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
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer disabled:opacity-50
              disabled:cursor-not-allowed brightness-120 hover:scale-[1.02] active:scale-[0.98] text-primary-800 dark:text-primary"
            style={{ background: currentVariant.preview }}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            onClick={handleAnimatedClose}
            className="w-full py-2 text-sm text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 transition-colors cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
