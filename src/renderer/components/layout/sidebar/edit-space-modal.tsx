import { useReducer, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Text, Heading3, Input, Button, toast } from "@/components/ui";
import { useUpdateSpaceMutation } from "@/lib/redux/api";
import type { Space } from "@/lib/redux/api";
import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  solidColors,
  gradientColors,
  getThemeVariant,
  type ThemeColor,
} from "@/lib/space-themes";
import { availableIcons, parseIcon } from "@/lib/icon-registry";
import SpaceIconPicker from "./space-icon-picker";
import SpaceThemeSelector from "./space-theme-selector";

type IconPickerMode = "emoji" | "icon";

interface EditSpaceFormState {
  name: string;
  icon: string;
  iconMode: IconPickerMode;
  selectedColorIndex: number;
  isEmojiPickerOpen: boolean;
  showGradients: boolean;
  systemPrompt: string;
  isClosing: boolean;
  prevSpaceId: string | null;
}

const mergeState = (prev: EditSpaceFormState, next: Partial<EditSpaceFormState>): EditSpaceFormState => ({
  ...prev,
  ...next,
});

interface EditSpaceModalProps {
  isOpen: boolean;
  space: Space | null;
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

    for (let i = 0; i < gradientColors.length; i++) {
      if (gradientColors[i].dark.value === darkBg) {
        return { colorIndex: i, isGradient: true };
      }
    }

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

function EditSpacePreviewIcon({ icon, iconMode }: { icon: string; iconMode: IconPickerMode }) {
  if (iconMode === "icon" && icon) {
    const IconComp = availableIcons.find((i) => i.name === icon)?.component;
    return IconComp ? (
      <IconComp className="size-6 text-primary-800 dark:text-primary" />
    ) : null;
  }
  return <>{icon || ""}</>;
}

export default function EditSpaceModal({
  isOpen,
  space,
  onClose,
  onSuccess,
  sidebarWidth = "19rem",
}: EditSpaceModalProps) {
  const [state, updateState] = useReducer(mergeState, {
    name: "",
    icon: "",
    iconMode: "emoji" as IconPickerMode,
    selectedColorIndex: 0,
    isEmojiPickerOpen: false,
    showGradients: false,
    systemPrompt: "",
    isClosing: false,
    prevSpaceId: space?.id ?? null,
  });
  const { name, icon, iconMode, selectedColorIndex, isEmojiPickerOpen, showGradients, systemPrompt, isClosing } = state;

  const [updateSpace, { isLoading }] = useUpdateSpaceMutation();
  const { darkMode } = useDarkMode();

  // Sync form state when space changes or modal opens
  if (space && space.id !== state.prevSpaceId) {
    let newIconMode: IconPickerMode = "emoji";
    let newIcon = "";
    const iconStr = space.icon || "";
    if (iconStr.startsWith("icon:")) {
      newIconMode = "icon";
      newIcon = iconStr.replace("icon:", "");
    } else if (iconStr.startsWith("emoji:")) {
      newIconMode = "emoji";
      newIcon = iconStr.replace("emoji:", "");
    } else {
      const parsedIcon = parseIcon(iconStr);
      if (parsedIcon.type === "icon" || parsedIcon.type === "copilot-animate" || parsedIcon.type === "claude-animate") {
        newIconMode = "icon";
        newIcon = iconStr.toLowerCase();
      } else {
        newIconMode = "emoji";
        newIcon = typeof parsedIcon.value === "string" ? parsedIcon.value : "😊";
      }
    }
    const { colorIndex, isGradient } = parseThemeConfig(space.themeConfig);
    updateState({
      prevSpaceId: space.id,
      name: space.name,
      systemPrompt: space.systemPrompt || "",
      iconMode: newIconMode,
      icon: newIcon,
      selectedColorIndex: colorIndex,
      showGradients: isGradient,
      isClosing: false,
    });
  }

  const handleAnimatedClose = useCallback(() => {
    updateState({ isClosing: true });
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

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

  const handleSave = async () => {
    if (!space) return;

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

      await updateSpace({
        id: space.id,
        payload: {
          name: name.trim(),
          icon: iconValue,
          themeConfig,
          systemPrompt: systemPrompt.trim() || undefined,
        },
      }).unwrap();

      toast.success("Space updated!");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error updating space:", error);
      toast.error("Failed to update space");
    }
  };

  if (!isOpen || !space) return null;

  const currentColors = showGradients ? gradientColors : solidColors;
  const selectedColorPair: ThemeColor =
    currentColors[selectedColorIndex] || solidColors[0];
  const currentVariant = getThemeVariant(selectedColorPair, darkMode);

  return createPortal(
    <div className="fixed inset-0 z-100">
      <div
        className="absolute inset-0 bg-primary-950/50 transition-opacity duration-200"
        style={{ opacity: isClosing ? 0 : 1 }}
        role="presentation"
        onClick={handleAnimatedClose}
      />
      <div
        className={`absolute left-0 bottom-0 z-40 min-h-[calc(60vh-2rem)] overflow-hidden rounded-t-3xl ${isClosing ? "animate-modal-out" : "animate-modal-in"}`}
        style={{
          width: sidebarWidth,
          background: currentVariant.preview,
        }}
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center pt-6 pb-4 px-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2"
            style={{ background: currentVariant.preview }}
          >
            <EditSpacePreviewIcon icon={icon} iconMode={iconMode} />
          </div>
          <Heading3 className="text-center text-primary-800 dark:text-primary">
            Edit Space
          </Heading3>
        </div>

        {/* Content */}
        <div className="px-4 space-y-4 overflow-y-auto max-h-[50vh] noscrollbar">
          <div className="relative">
            <Input
              type="text"
              value={name}
              onChange={(e) => updateState({ name: e.target.value })}
              placeholder="Space name..."
              className="w-full px-3 py-2 border-0! shadow-none!
                bg-primary-950/10! dark:bg-primary/4
                dark:placeholder:text-primary-100!
                placeholder:text-primary-700!
                text-primary-800 dark:text-primary
                text-sm focus:outline-none
                flex items-center justify-between
                transition-all
                dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]"
            />
          </div>

          <SpaceIconPicker
            icon={icon}
            iconMode={iconMode}
            isOpen={isEmojiPickerOpen}
            previewBackground={currentVariant.preview}
            onToggle={() => updateState({ isEmojiPickerOpen: !isEmojiPickerOpen })}
            onSelectEmoji={(emoji) => updateState({ icon: emoji, isEmojiPickerOpen: false })}
            onSelectIcon={(iconName) => updateState({ icon: iconName, isEmojiPickerOpen: false })}
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

          <SpaceThemeSelector
            selectedColorIndex={selectedColorIndex}
            showGradients={showGradients}
            onSelectColor={(index) => updateState({ selectedColorIndex: index })}
            onToggleGradients={(show) => updateState({ showGradients: show, selectedColorIndex: 0 })}
          />
        </div>

        {/* Footer Actions */}
        <div className="p-4 space-y-2">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer disabled:opacity-50
              disabled:cursor-not-allowed brightness-120 hover:scale-[1.01] active:scale-99 text-primary-800 dark:text-primary"
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
