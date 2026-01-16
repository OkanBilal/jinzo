import { useState, useEffect, useRef } from "react";
import Text, { Heading3 } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateMoodMutation } from "@/lib/redux/api";
import { toast } from "sonner";
import { EmojiPicker } from "frimousse";
import { useClickOutside } from "@/features/chat/hooks/use-click-outside";

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
  const [backgroundColor, setBackgroundColor] = useState("#0f172a80");
  const [opacity, setOpacity] = useState(100);
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);
  const originalBackgroundColor = useRef<string>("");

  const [createMood, { isLoading }] = useCreateMoodMutation();

  // Save original background color on mount
  useEffect(() => {
    const appRoot = document.querySelector(".app-root") as HTMLElement;
    if (appRoot) {
      originalBackgroundColor.current = appRoot.style.backgroundColor || "";
    }

    // Restore original color on unmount (if user cancels)
    return () => {
      if (appRoot && originalBackgroundColor.current) {
        appRoot.style.backgroundColor = originalBackgroundColor.current;
      }
    };
  }, []);

  useClickOutside(emojiPickerRef, () => {
    if (isEmojiPickerOpen) setIsEmojiPickerOpen(false);
  });

  useClickOutside(themePickerRef, () => {
    if (isThemeExpanded) setIsThemeExpanded(false);
  });

  // Apply live preview when color changes
  useEffect(() => {
    const appRoot = document.querySelector(".app-root");
    if (appRoot) {
      (appRoot as HTMLElement).style.backgroundColor = backgroundColor;
    }
  }, [backgroundColor]);

  const handleColorChange = (color: string) => {
    const opacityHex = Math.round((opacity / 100) * 255)
      .toString(16)
      .padStart(2, "0");
    const colorWithOpacity = color.length === 7 ? color + opacityHex : color;
    setBackgroundColor(colorWithOpacity);
  };

  const handleOpacityChange = (newOpacity: number) => {
    setOpacity(newOpacity);
    const opacityHex = Math.round((newOpacity / 100) * 255)
      .toString(16)
      .padStart(2, "0");
    const baseColor = backgroundColor.slice(0, 7);
    setBackgroundColor(baseColor + opacityHex);
  };

  const handlePresetColor = (color: string) => {
    setBackgroundColor(color);
    const opacityHex = color.slice(7, 9);
    const opacityValue = Math.round((parseInt(opacityHex, 16) / 255) * 100);
    setOpacity(opacityValue);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a mood name");
      return;
    }

    try {
      const themeConfig = JSON.stringify({ backgroundColor });
      await createMood({
        name: name.trim(),
        icon: icon || "😊",
        themeConfig,
      }).unwrap();

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

  const presetColors = [
    "#0f172aff",
    "#1e293bff",
    "#1e1b4bff",
    "#312e81ff",
    "#1e3a8aff",
    "#064e3bff",
    "#14532dff",
    "#78350fff",
    "#7c2d12ff",
    "#881337ff",
  ];

  return (
    <div
      className="flex flex-col h-full"
      style={{ animation: "fadeIn 300ms ease-in-out" }}
    >
      {/* Header with icon preview */}
      <div className="flex flex-col items-center pt-8 pb-6 px-4">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-4 border-2 border-white/10"
          style={{ backgroundColor: backgroundColor.slice(0, 7) + "40" }}
        >
          {icon || "😊"}
        </div>
        <Heading3 className="text-center">{name || "Create Mood"} </Heading3>
        <Text className="text-primary-500 dark:text-primary-400 text-sm text-center mt-1">
          Customize your workspace experience
        </Text>
      </div>

      {/* Form */}
      <div className="flex-1 px-4 space-y-4 overflow-y-auto noscrollbar">
        {/* Name Input */}
        <div className="relative">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mood name..."
            className="w-full px-3 py-2 
              bg-primary-950/2 dark:bg-primary/4 
              border border-primary-950/10 dark:border-primary/10
              text-primary-800 dark:text-primary-200 
              text-sm focus:outline-none 
              flex items-center justify-between 
              transition-all
              shadow-[inset_0_0.5px_0_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]"
            autoFocus
          />
        </div>

        {/* Icon Selector */}
        <div ref={emojiPickerRef} className="relative">
          {/* Trigger Button - Select component style */}
          <button
            type="button"
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
            className={`
              w-full px-3 py-2 
              bg-primary-950/2 dark:bg-primary/4 
              border border-primary-950/10 dark:border-primary/10
              text-primary-800 dark:text-primary-200 
              text-sm focus:outline-none cursor-pointer 
              flex items-center justify-between 
              transition-all
              shadow-[inset_0_0.5px_0_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]
              ${
                isEmojiPickerOpen
                  ? "rounded-t-xl shadow-lg"
                  : "rounded-xl hover:bg-primary-950/4 dark:hover:bg-primary/6"
              }
            `}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{icon || "😊"}</span>
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

          {/* Emoji Picker Dropdown - Absolute positioned like Select options */}
          {isEmojiPickerOpen && (
            <div
              className="absolute top-full left-0 right-0 z-50 
                bg-primary/98 dark:bg-primary-900/98
                border border-t-0 border-primary-950/10 dark:border-primary/10 
                rounded-b-xl shadow-lg overflow-hidden
                animate-slideDown"
            >
              <div className="p-3">
                <EmojiPicker.Root
                  onEmojiSelect={(emoji) => {
                    setIcon(emoji.emoji);
                    setIsEmojiPickerOpen(false);
                  }}
                >
                  <EmojiPicker.Search
                    placeholder="Search emoji..."
                    className="w-full mb-2 px-2 py-1.5 placeholder:text-primary-200 bg-primary-950/5 dark:bg-primary/10 rounded-xl text-sm outline-none focus:bg-primary-950/8 dark:focus:bg-primary/15 border border-primary-950/10 dark:border-primary/10"
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
                            className="px-2 pt-0 pb-1.5 font-medium text-primary-600 dark:text-primary-400 bg-primary-900 text-xs"
                            {...props}
                          >
                            {category.label}
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
              </div>
            </div>
          )}
        </div>

        {/* Theme Selector */}
        <div ref={themePickerRef} className="relative">
          {/* Trigger Button - Select component style */}
          <button
            type="button"
            onClick={() => setIsThemeExpanded(!isThemeExpanded)}
            className={`
              w-full px-3 py-2 
              bg-primary-950/2 dark:bg-primary/4 
              border border-primary-950/10 dark:border-primary/10
              text-primary-800 dark:text-primary-200 
              text-sm focus:outline-none cursor-pointer 
              flex items-center justify-between 
              transition-all
              shadow-[inset_0_0.5px_0_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]
              ${
                isThemeExpanded
                  ? "rounded-t-xl shadow-lg"
                  : "rounded-xl hover:bg-primary-950/4 dark:hover:bg-primary/6"
              }
            `}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded border border-primary-950/20 dark:border-primary/20"
                style={{ backgroundColor: backgroundColor.slice(0, 7) }}
              />
              <span>Choose a Theme</span>
            </div>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                isThemeExpanded ? "rotate-180" : ""
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

          {/* Theme Options Dropdown - Absolute positioned like Select options */}
          {isThemeExpanded && (
            <div
              className="absolute top-full left-0 right-0 z-50 
                bg-primary/98 dark:bg-primary-900/98
                border border-t-0 border-primary-950/10 dark:border-primary/10 
                rounded-b-xl shadow-lg overflow-hidden
                animate-slideDown"
            >
              <div className="p-3 space-y-3">
                {/* Color Preview & Picker */}
                <div className="flex items-center gap-3">
                  <div
                    className="shrink-0 w-10 h-10 rounded-lg border-2 border-white/10"
                    style={{ backgroundColor }}
                  />
                  <input
                    type="color"
                    value={backgroundColor.slice(0, 7)}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="flex-1 h-10 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Opacity Slider */}
                <div className="flex items-center gap-2">
                  <Text className="text-xs shrink-0">Opacity</Text>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={opacity}
                    onChange={(e) =>
                      handleOpacityChange(Number(e.target.value))
                    }
                    className="flex-1"
                  />
                  <Text className="text-xs font-mono w-10 text-right">
                    {opacity}%
                  </Text>
                </div>

                {/* Preset Colors */}
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handlePresetColor(color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        backgroundColor === color
                          ? "border-white scale-110"
                          : "border-white/10 hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 space-y-2">
        <Button
          onClick={handleCreate}
          isLoading={isLoading}
          variant="primary"
          size="md"
          className="w-full"
        >
          Create Mood
        </Button>
        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-primary-400 hover:text-primary-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
