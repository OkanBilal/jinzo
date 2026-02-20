import { useReducer, useEffect, useRef } from "react";
import Text, { Heading3 } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import {
  useCreateMoodMutation,
  useSetActiveMoodMutation,
} from "@/lib/redux/api";
import { toast } from "@/components/ui/toast";
import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  solidColors,
  gradientColors,
  getThemeVariant,
} from "@/lib/mood-themes";
import { availableIcons } from "@/lib/icon-registry";
import { Button } from "@/components/ui/button";
import MoodIconPicker from "./mood-icon-picker";
import MoodThemeSelector from "./mood-theme-selector";

type IconPickerMode = "emoji" | "icon";

function MoodPreviewIcon({ icon, iconMode }: { icon: string; iconMode: IconPickerMode }) {
  if (iconMode === "icon" && icon) {
    const IconComp = availableIcons.find((i) => i.name === icon)?.component;
    return IconComp ? (
      <IconComp className="size-7 text-primary-800 dark:text-primary" />
    ) : null;
  }
  return <>{icon || ""}</>;
}

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
        appRoot.style.removeProperty("--mood-preview-bg");
      }
    };
  }, []);

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
      appRoot.style.setProperty("--mood-preview-bg", currentVariant.preview);
    }
  }, [backgroundColor, currentVariant.preview]);

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

  return (
    <div
      className="flex flex-col h-full"
      style={{ animation: "slide-fade-down 300ms ease-in-out" }}
    >
      <div className="flex flex-col items-center pt-8 pb-6 px-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-3xl mb-2 "
          style={{ background: currentVariant.preview }}
        >
          <MoodPreviewIcon icon={icon} iconMode={iconMode} />
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

        <MoodIconPicker
          icon={icon}
          iconMode={iconMode}
          isOpen={isEmojiPickerOpen}
          previewBackground={currentVariant.preview}
          onToggle={() => updateState({ isEmojiPickerOpen: !isEmojiPickerOpen })}
          onSelectEmoji={(emoji) => updateState({ icon: emoji, isEmojiPickerOpen: false })}
          onSelectIcon={(name) => updateState({ icon: name, isEmojiPickerOpen: false })}
          onSwitchMode={(mode) => updateState({ iconMode: mode, icon: "" })}
          onClose={() => updateState({ isEmojiPickerOpen: false })}
        />

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

        <MoodThemeSelector
          selectedColorIndex={selectedColorIndex}
          showGradients={showGradients}
          onSelectColor={(index) => updateState({ selectedColorIndex: index })}
          onToggleGradients={(show) => updateState({ showGradients: show, selectedColorIndex: 0 })}
        />
      </div>

      <div className="p-4 space-y-2">
        <Button
          onClick={handleCreate}
          disabled={isLoading}
          className="w-full py-2.5 px-3 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer disabled:opacity-50
          disabled:cursor-not-allowed brightness-120 hover:scale-101 active:scale-99 text-primary-800 dark:text-primary"
          style={{ background: currentVariant.preview }}
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
