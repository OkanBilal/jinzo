import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Body, Button, toast } from "@/components/ui";
import {
  useCreateSpaceMutation,
  useSetActiveSpaceMutation,
} from "@/lib/redux/api";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useActiveSpace } from "@/hooks/use-active-space";
import { parseIcon } from "@/lib/icon-registry";
import { predefinedSpaces, type PredefinedSpace } from "@/lib/predefined-spaces";

interface PresetSpacesViewProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PresetSpacesView({
  onClose,
  onSuccess,
}: PresetSpacesViewProps) {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] =
    useState<PredefinedSpace | null>(null);
  const [createSpace, { isLoading }] = useCreateSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();
  const { darkMode } = useDarkMode();
  const { spaces } = useActiveSpace();
  const originalBackgroundColor = useRef<string>("");

  // Filter out presets that already exist as spaces
  const availablePresets = useMemo(() => {
    const existingSpaceNames = spaces.map((m) => m.name);
    return predefinedSpaces.filter((preset) => !existingSpaceNames.includes(preset.name));
  }, [spaces]);

  useEffect(() => {
    const appRoot = document.querySelector(".app-root") as HTMLElement;
    if (appRoot) {
      originalBackgroundColor.current = appRoot.style.backgroundColor || "";
    }

    return () => {
      if (appRoot && originalBackgroundColor.current) {
        if (originalBackgroundColor.current) {
          appRoot.style.backgroundColor = originalBackgroundColor.current;
        }
        appRoot.style.removeProperty("--space-preview-bg");
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedTemplate) return;

    const appRoot = document.querySelector(".app-root") as HTMLElement;
    if (appRoot) {
      const templateVariant = darkMode
        ? selectedTemplate.theme.dark
        : selectedTemplate.theme.light;
      const backgroundColor = templateVariant.value;

      if (backgroundColor.startsWith("linear-gradient")) {
        appRoot.style.backgroundColor = "transparent";
        appRoot.style.background = backgroundColor;
      } else {
        appRoot.style.background = "none";
        appRoot.style.backgroundColor = backgroundColor;
      }

      // Set CSS custom property for dropdown backgrounds
      const dropdownBg = templateVariant.preview;
      appRoot.style.setProperty("--space-preview-bg", dropdownBg);
    }
  }, [selectedTemplate, darkMode]);

  const handleCreate = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a space template");
      return;
    }

    try {
      const themeConfig = JSON.stringify({
        lightBackground: selectedTemplate.theme.light.value,
        darkBackground: selectedTemplate.theme.dark.value,
      });

      const uiConfig = selectedTemplate.uiConfig
        ? JSON.stringify(selectedTemplate.uiConfig)
        : undefined;

      const result = await createSpace({
        name: selectedTemplate.name,
        icon: selectedTemplate.icon,
        themeConfig,
        systemPrompt: selectedTemplate.systemPrompt,
        uiConfig,
      }).unwrap();

      if (result?.id) {
        await setActiveSpace(result.id).unwrap();
      }

      // Clear the original color ref so cleanup doesn't restore it
      originalBackgroundColor.current = "";

      // Navigate to default route if it exists, otherwise go to home
      const defaultRoute = selectedTemplate.uiConfig?.sidebar?.defaultRoute || "/";
      navigate(defaultRoute);

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
      <div className="flex flex-col items-center pt-12 px-3">
        <Body className="text-center text-base text-primary-800 dark:text-primary">
          Preset Spaces
        </Body>
      </div>

      <div className="flex-1 px-3 py-2 noscrollbar">
        <div className="grid grid-cols-2 gap-3">
          {availablePresets.map((template) => {
            const templateIcon = parseIcon(template.icon);
            const templateVariant = darkMode
              ? template.theme.dark
              : template.theme.light;
            const isSelected = selectedTemplate?.id === template.id;

            return (
              <Button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplate(template)}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all cursor-pointer
                  ${isSelected ? "saturate-180" : ""}`}
                style={{ background: templateVariant.preview }}
              >
                <span className="text-2xl">
                  {templateIcon.type === "emoji"
                    ? (templateIcon.value as string)
                    : (() => {
                        const IconComp =
                          templateIcon.value as React.ComponentType<{
                            className?: string;
                          }>;
                        const iconColorClass =
                          "text-primary-800 dark:text-primary";
                        return (
                          <IconComp className={`size-6 ${iconColorClass}`} />
                        );
                      })()}
                </span>
                <span className="text-sm font-medium text-primary-700 dark:text-primary-200">
                  {template.name}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <Button
          onClick={handleCreate}
          disabled={isLoading}
          className="w-full py-2.5 px-3 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer disabled:opacity-50
          disabled:cursor-not-allowed brightness-120 text-primary-800 dark:text-primary dark:bg-primary/5 dark:hover:bg-primary/10 bg-primary/20 hover:bg-primary/50"

        >
          {isLoading ? "Loading..." : "Choose" + (selectedTemplate ? ` ${selectedTemplate.name}` : "")}
        </Button>
        <Button
          onClick={onClose}
          className="w-full py-2 text-sm text-primary-900 font-medium dark:text-primary-300 hover:text-primary-950 dark:hover:text-primary-200 transition-colors cursor-pointer"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
