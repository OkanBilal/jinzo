import { useState } from "react";
import { Heading3 } from "@/components/ui/text";
import {
  useCreateMoodMutation,
  useSetActiveMoodMutation,
} from "@/lib/redux/api";
import { toast } from "@/components/toast";
import { useDarkMode } from "@/hooks/useDarkMode";
import { parseIcon } from "@/lib/icon-registry";
import { predefinedMoods, type PredefinedMood } from "@/lib/predefined-moods";
import { Button } from "@/components/ui/button";

interface PresetMoodsViewProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PresetMoodsView({
  onClose,
  onSuccess,
}: PresetMoodsViewProps) {
  const [selectedTemplate, setSelectedTemplate] =
    useState<PredefinedMood | null>(null);
  const [createMood, { isLoading }] = useCreateMoodMutation();
  const [setActiveMood] = useSetActiveMoodMutation();
  const { darkMode } = useDarkMode();

  const handleCreate = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a mood template");
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

      const result = await createMood({
        name: selectedTemplate.name,
        icon: selectedTemplate.icon,
        themeConfig,
        systemPrompt: selectedTemplate.systemPrompt,
        uiConfig,
      }).unwrap();

      if (result?.id) {
        await setActiveMood(result.id).unwrap();
      }

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
      style={{ animation: "fadeIn 300ms ease-in-out" }}
    >
      <div className="flex flex-col items-center pt-12 pb-6 px-4">
        <Heading3 className="text-center text-primary-800 dark:text-primary">
          Preset Moods
        </Heading3>
        <p className="text-sm text-primary-900 dark:text-primary-400 mt-1 text-center">
          Choose a preset to get started quickly
        </p>
      </div>

      <div className="flex-1 px-4 py-2 noscrollbar">
        <div className="grid grid-cols-2 gap-3">
          {predefinedMoods.map((template) => {
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
                className={`flex flex-col items-center gap-2 p-2 rounded-2xl transition-all cursor-pointer
                  ${isSelected ? "" : "hover:scale-[1.02]"}`}
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
                          template.name === "Claude"
                            ? "text-[#D97757] dark:text-primary"
                            : "text-primary-800 dark:text-primary";
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

      <div className="p-4 space-y-2">
        <Button
          onClick={handleCreate}
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 
          disabled:cursor-not-allowed brightness-120 hover:scale-[1.02] active:scale-[0.98] text-primary-800 dark:text-primary"
          style={{
            background: darkMode
              ? selectedTemplate?.theme.dark.preview
              : selectedTemplate?.theme.light.preview,
          }}
        >
          {isLoading ? "Creating..." : "Create"}
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
