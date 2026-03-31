import { useReducer, useEffect, useRef } from "react";
import { Text, Heading3, Input, Button, toast } from "@/components/ui";
import {
  useCreateSpaceMutation,
  useSetActiveSpaceMutation,
} from "@/lib/redux/api";
import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  solidColors,
  gradientColors,
  getThemeVariant,
} from "@/lib/space-themes";
import { availableIcons } from "@/lib/icon-registry";
import SpaceIconPicker from "./space-icon-picker";
import SpaceThemeSelector from "./space-theme-selector";

type IconPickerMode = "emoji" | "icon";

function SpacePreviewIcon({ icon, iconMode }: { icon: string; iconMode: IconPickerMode }) {
  if (iconMode === "icon" && icon) {
    const IconComp = availableIcons.find((i) => i.name === icon)?.component;
    return IconComp ? (
      <IconComp className="size-7 text-primary-800 dark:text-primary" />
    ) : null;
  }
  return <>{icon || ""}</>;
}

interface CreateSpaceFormState {
  name: string;
  icon: string;
  iconMode: IconPickerMode;
  selectedColorIndex: number;
  isEmojiPickerOpen: boolean;
  showGradients: boolean;
  systemPrompt: string;
}

const mergeState = (prev: CreateSpaceFormState, next: Partial<CreateSpaceFormState>): CreateSpaceFormState => ({
  ...prev,
  ...next,
});

interface CreateSpaceViewProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateSpaceView({
  onClose,
  onSuccess,
}: CreateSpaceViewProps) {
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

  const [createSpace, { isLoading }] = useCreateSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();
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
        appRoot.style.removeProperty("--space-preview-bg");
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
      appRoot.style.setProperty("--space-preview-bg", currentVariant.preview);
    }
  }, [backgroundColor, currentVariant.preview]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a space name");
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

      const result = await createSpace({
        name: name.trim(),
        icon: iconValue,
        themeConfig,
        systemPrompt: systemPrompt.trim() || undefined,
      }).unwrap();

      if (result?.id) {
        await setActiveSpace(result.id).unwrap();
      }

      originalBackgroundColor.current = "";
      toast.success("Space created!");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error creating space:", error);
      toast.error("Failed to create space");
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
          <SpacePreviewIcon icon={icon} iconMode={iconMode} />
        </div>
        <Heading3 className="text-center text-primary-800 dark:text-primary">
          {name || "Create Space"}{" "}
        </Heading3>
      </div>

      <div className="flex-1 px-3 space-y-4 overflow-y-auto noscrollbar">
        <div className="relative">
          <Input
            type="text"
            value={name}
            onChange={(e) => updateState({ name: e.target.value })}
            placeholder="Space name..."
            className="w-full px-3 py-2 border-0 shadow-none
              bg-primary-950/10 dark:bg-primary/4
              dark:placeholder:text-primary-100
              placeholder:text-primary-700
              text-primary-800 dark:text-primary
              text-sm focus:outline-none
              flex items-center justify-between
              transition-all
            "
          />
        </div>

        <SpaceIconPicker
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
              dark:shadow-(--shadow-inset-subtle-dark)"
          />
        </div>

        <SpaceThemeSelector
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
          {isLoading ? "Creating..." : "Create Space"}
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
