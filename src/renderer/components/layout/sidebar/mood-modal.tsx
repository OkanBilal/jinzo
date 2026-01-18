import { useState, useSyncExternalStore, useEffect } from "react";
import { createPortal } from "react-dom";
import { Close } from "@/components/ui/icons";
import Text, { Heading3 } from "@/components/ui/text";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Select from "@/components/ui/select";
import { useGetOllamaModelsQuery } from "@/lib/redux/api";

interface MoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (moodData: MoodFormData) => Promise<void>;
  mood: "create" | "edit";
  initialData?: Partial<MoodFormData>;
}

export interface MoodFormData {
  name: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  icon?: string;
  themeConfig?: string;
}

const emptySubscribe = () => () => {};

export function MoodModal({
  isOpen,
  onClose,
  onSave,
  mood,
  initialData,
}: MoodModalProps) {
  const isBrowser = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [formData, setFormData] = useState<MoodFormData>({
    name: "",
    slug: "",
    description: "",
    systemPrompt: "",
    model: "",
    icon: "",
    themeConfig: JSON.stringify({ backgroundColor: "#0f172aff" }),
  });

  const [backgroundColor, setBackgroundColor] = useState("#0f172aff");
  const [opacity, setOpacity] = useState(100);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Fetch available models
  const { data: modelsData } = useGetOllamaModelsQuery();
  const availableModels = modelsData?.models || [];

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        let bgColor = "#0f172aff";
        if (initialData.themeConfig) {
          try {
            const theme = JSON.parse(initialData.themeConfig);
            bgColor = theme.backgroundColor || "#0f172aff";
          } catch (e) {
            console.error("Failed to parse themeConfig:", e);
          }
        }
        setBackgroundColor(bgColor);
        // Extract opacity from hex8 format
        const opacityHex = bgColor.length === 9 ? bgColor.slice(7, 9) : "ff";
        const opacityValue = Math.round((parseInt(opacityHex, 16) / 255) * 100);
        setOpacity(opacityValue);
        setFormData({
          name: initialData.name || "",
          slug: initialData.slug || "",
          description: initialData.description || "",
          systemPrompt: initialData.systemPrompt || "",
          model: initialData.model || "",
          icon: initialData.icon || "",
          themeConfig: initialData.themeConfig || JSON.stringify({ backgroundColor: bgColor }),
        });
      } else {
        setBackgroundColor("#0f172aff");
        setOpacity(100);
        setFormData({
          name: "",
          slug: "",
          description: "",
          systemPrompt: "",
          model: "",
          icon: "",
          themeConfig: JSON.stringify({ backgroundColor: "#0f172aff" }),
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  const handleChange = (field: keyof MoodFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user types
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleColorChange = (color: string) => {
    // Keep current opacity when color changes
    const opacityHex = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
    const colorWithOpacity = color.length === 7 ? color + opacityHex : color;
    setBackgroundColor(colorWithOpacity);
    const themeConfig = JSON.stringify({ backgroundColor: colorWithOpacity });
    setFormData((prev) => ({ ...prev, themeConfig }));
    
    // Apply live preview to app background
    const appRoot = document.querySelector('.app-root');
    if (appRoot) {
      (appRoot as HTMLElement).style.backgroundColor = colorWithOpacity;
    }
  };

  const handleOpacityChange = (newOpacity: number) => {
    setOpacity(newOpacity);
    // Convert opacity to hex (00-ff)
    const opacityHex = Math.round((newOpacity / 100) * 255).toString(16).padStart(2, '0');
    // Get base color (first 7 chars)
    const baseColor = backgroundColor.slice(0, 7);
    const colorWithOpacity = baseColor + opacityHex;
    setBackgroundColor(colorWithOpacity);
    const themeConfig = JSON.stringify({ backgroundColor: colorWithOpacity });
    setFormData((prev) => ({ ...prev, themeConfig }));
    
    // Apply live preview to app background
    const appRoot = document.querySelector('.app-root');
    if (appRoot) {
      (appRoot as HTMLElement).style.backgroundColor = colorWithOpacity;
    }
  };

  const handleSave = async () => {
    // Validate
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Error saving mood:", error);
      setErrors({ general: "Failed to save mood. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  if (!isBrowser || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      <div className="absolute inset-0 " onClick={onClose} />
      <div
        className="relative z-40 w-full max-w-160 bg-white/95 dark:bg-primary-900/95 border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          animation: "scaleIn 150ms ease-out",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/10">
          <Heading3 >
            {mood === "create" ? "Create New Mood" : "Edit Mood"}
          </Heading3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
          >
            <Close className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-120 overflow-y-auto">
          {errors.general && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <Text className="text-red-600 dark:text-red-400 text-sm">
                {errors.general}
              </Text>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="mood-name" className="block">
              <Text className="font-medium text-sm">
                Name <span className="text-red-500">*</span>
              </Text>
            </label>
            <Input
              id="mood-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g., Work Focus, Creative Mood, Deep Research"
              hasError={!!errors.name}
              className="w-full"
              autoFocus
            />
            {errors.name && (
              <Text className="text-red-500 text-xs">{errors.name}</Text>
            )}
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <label htmlFor="mood-icon" className="block">
              <Text className="font-medium text-sm">Icon</Text>
            </label>
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-12 h-12 flex items-center justify-center bg-primary-100 dark:bg-primary-800 rounded-xl text-2xl">
                {formData.icon || "😊"}
              </div>
              <div className="flex-1">
                <Input
                  id="mood-icon"
                  type="text"
                  value={formData.icon}
                  onChange={(e) => handleChange("icon", e.target.value)}
                  placeholder="Paste an emoji or leave empty"
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {["😊", "💼", "🎨", "🔬", "📚", "💡", "🎯", "🚀", "🌟", "⚡", "🧠", "🎵", "✍️", "🏃", "🧘"].map(
                (emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleChange("icon", emoji)}
                    className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg transition-colors ${
                      formData.icon === emoji
                        ? "bg-primary-500 dark:bg-primary-600"
                        : "bg-primary-100 dark:bg-primary-800 hover:bg-primary-200 dark:hover:bg-primary-700"
                    }`}
                  >
                    {emoji}
                  </button>
                )
              )}
            </div>
            <Text className="text-xs text-primary-500 dark:text-primary-400">
              Select a quick emoji or paste your own
            </Text>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <label htmlFor="mood-bg-color" className="block">
              <Text className="font-medium text-sm">Background Color</Text>
            </label>
            <div className="flex items-center gap-3">
              <div
                className="shrink-0 w-12 h-12 rounded-xl border-2 border-black/10 dark:border-white/10"
                style={{ backgroundColor }}
              />
              <div className="flex-1 space-y-2">
                <input
                  id="mood-bg-color"
                  type="color"
                  value={backgroundColor.slice(0, 7)}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-full h-10 rounded-lg cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <Text className="text-xs font-medium shrink-0">Opacity:</Text>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={opacity}
                    onChange={(e) => handleOpacityChange(Number(e.target.value))}
                    className="flex-1"
                  />
                  <Text className="text-xs font-mono w-12 text-right">{opacity}%</Text>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "#0f172aff", // slate-900
                "#1e293bff", // slate-800
                "#1e1b4bff", // indigo-950
                "#312e81ff", // indigo-900
                "#1e3a8aff", // blue-900
                "#064e3bff", // emerald-900
                "#14532dff", // green-900
                "#78350fff", // amber-900
                "#7c2d12ff", // orange-900
                "#881337ff", // rose-900
              ].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setBackgroundColor(color);
                    const opacityHex = color.slice(7, 9);
                    const opacityValue = Math.round((parseInt(opacityHex, 16) / 255) * 100);
                    setOpacity(opacityValue);
                    const themeConfig = JSON.stringify({ backgroundColor: color });
                    setFormData((prev) => ({ ...prev, themeConfig }));
                    const appRoot = document.querySelector('.app-root');
                    if (appRoot) {
                      (appRoot as HTMLElement).style.backgroundColor = color;
                    }
                  }}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    backgroundColor === color
                      ? "border-white scale-110"
                      : "border-black/10 dark:border-white/10 hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <Text className="text-xs text-primary-500 dark:text-primary-400">
              Choose a background color - changes preview in real-time
            </Text>
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <label htmlFor="mood-slug" className="block">
              <Text className="font-medium text-sm">Slug</Text>
            </label>
            <Input
              id="mood-slug"
              type="text"
              value={formData.slug}
              onChange={(e) => handleChange("slug", e.target.value)}
              placeholder="auto-generated from name if empty"
              hasError={!!errors.slug}
              className="w-full"
            />
            {errors.slug && (
              <Text className="text-red-500 text-xs">{errors.slug}</Text>
            )}
            <Text className="text-xs text-primary-500 dark:text-primary-400">
              URL-friendly identifier (leave empty to auto-generate)
            </Text>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="mood-description" className="block">
              <Text className="font-medium text-sm">Description</Text>
            </label>
            <Textarea
              id="mood-description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Describe what this mood is for..."
              rows={3}
              className="w-full"
            />
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <label htmlFor="mood-system-prompt" className="block">
              <Text className="font-medium text-sm">System Prompt</Text>
            </label>
            <Textarea
              id="mood-system-prompt"
              value={formData.systemPrompt}
              onChange={(e) => handleChange("systemPrompt", e.target.value)}
              placeholder="Custom instructions for this mood..."
              rows={6}
              className="w-full font-mono text-xs"
            />
            <Text className="text-xs text-primary-500 dark:text-primary-400">
              Custom system instructions that will be used when chatting in this mood
            </Text>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <label htmlFor="mood-model" className="block">
              <Text className="font-medium text-sm">Model</Text>
            </label>
            <Select
              value={formData.model || ""}
              options={[
                { value: "", label: "No preference" },
                ...availableModels.map((model) => ({
                  value: model,
                  label: model,
                })),
              ]}
              onChange={(value) => handleChange("model", value)}
              placeholder="Select a model"
            />
            <Text className="text-xs text-primary-500 dark:text-primary-400">
              Preferred AI model for this mood
            </Text>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-black/5 dark:border-white/10">
          <Button onClick={onClose} variant="ghost" size="sm">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            isLoading={isSaving}
            variant="primary"
            size="sm"
          >
            {mood === "create" ? "Create Mood" : "Save Changes"}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
