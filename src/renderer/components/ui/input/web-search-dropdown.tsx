import { useState, RefObject } from "react";
import { Web } from "@/components/ui/icons";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import { Button } from "@/components/ui/button";
import {
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
} from "@/lib/redux/api";
import { Input } from "../input";

interface WebSearchDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
  webSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
}

export function WebSearchDropdown({
  isOpen,
  onToggle,
  dropdownRef,
  openUpward = false,
  webSearchEnabled,
  onWebSearchToggle,
}: WebSearchDropdownProps) {
  const { data: ollamaProvider } = useGetProviderByIdQuery("ollama");
  const [updateProvider] = useUpdateProviderMutation();
  const [editedApiKey, setEditedApiKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const existingKey = ollamaProvider?.config?.ollamaApiKey as
    | string
    | undefined;
  const apiKey = editedApiKey ?? existingKey ?? "";
  const hasApiKey = !!existingKey;

  const handleSaveKey = async () => {
    if (!apiKey.trim() || saving) return;

    setSaving(true);
    const currentConfig = ollamaProvider?.config || {};
    await updateProvider({
      id: "ollama",
      payload: {
        config: { ...currentConfig, ollamaApiKey: apiKey.trim() },
      },
    });

    setTimeout(() => {
      setSaving(false);
      onWebSearchToggle(true);
      onToggle();
    }, 300);
  };

  const handleToggle = () => {
    if (!hasApiKey && !webSearchEnabled) {
      onToggle();
      return;
    }
    onWebSearchToggle(!webSearchEnabled);
  };

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <Button
        type="button"
        tooltip={webSearchEnabled ? "Web search enabled" : "Web search"}
        tooltipPosition="top"
        onClick={handleToggle}
        className={` p-1.5 -mx-1.5 ${webSearchEnabled ? "bg-primary-100/50 dark:bg-primary-900/30" : ""} hover:bg-primary-200/30 dark:hover:bg-primary-800 rounded-full transition-colors cursor-pointer`}
        aria-label="Web search"
        aria-expanded={isOpen}
      >
        <Web
          className={`size-5 ${
            webSearchEnabled
              ? "text-primary-950 dark:text-primary"
              : "dark:text-primary-400 text-primary-500"
          }`}
        />
      </Button>

      <DropdownWrapper
        isOpen={isOpen}
        openUpward={openUpward}
        useFixedBackground={true}
        minWidth="min-w-[320px]"
      >
        <div className="p-3 space-y-3">
          <div className="text-xs font-medium text-primary-700 dark:text-primary-300">
            Ollama API Key
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setEditedApiKey(e.target.value)}
              placeholder="Enter API key..."
              className="w-full px-3 py-1.5 dark:bg-primary! shadow-none! dark:placeholder:text-primary-800! dark:text-primary-900 "
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveKey();
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="submit"
              onClick={handleSaveKey}
              disabled={saving}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors cursor-pointer"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
          {!hasApiKey && (
            <p className="text-t text-primary-500 dark:text-primary-500">
              Get your API key from ollama.com/settings/keys
            </p>
          )}
        </div>
      </DropdownWrapper>
    </div>
  );
}
