import { useState, useCallback } from "react";
import ChatInput from "@/features/chat/components/input";
import { AppState } from "@/features/chat/components/input/types";
import { useCreateChat } from "@/features/chat/hooks";
import { useGetAppsQuery } from "@/lib/redux/api";
import { Button } from "@/components/ui/button";

function CopilotTest() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const result = await window.api.copilot.chat(prompt);
      if (result.success) {
        setResponse(result.data);
      } else {
        setError(result.error || "Unknown error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to call copilot");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 w-80 p-4 rounded-xl bg-primary-100 dark:bg-primary-900 border border-primary-200 dark:border-primary-800 shadow-lg">
      <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-3">Copilot Test</h3>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ask something..."
        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-primary-800 border border-primary-300 dark:border-primary-700 text-sm text-primary-900 dark:text-primary-100 placeholder:text-primary-400 mb-2"
        onKeyDown={(e) => e.key === "Enter" && handleTest()}
      />
      <Button
        onClick={handleTest}
        disabled={loading || !prompt.trim()}
        variant="primary"
        className="w-full"
      >
        {loading ? "Loading..." : "Send to Copilot"}
      </Button>
      {error && (
        <div className="mt-3 p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs">
          {error}
        </div>
      )}
      {response && (
        <div className="mt-3 p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs whitespace-pre-wrap">
          {response}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const { data: apps = [] } = useGetAppsQuery();
  const { createChat, isSubmitting } = useCreateChat();

  const [query, setQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<AppState | null>(null);

  const handleSubmit = useCallback(
    (overrideText?: string) => {
      createChat(overrideText ?? query);
    },
    [query, createChat]
  );

  return (
    <div className="h-full w-full flex items-end justify-center px-8 pb-8 relative">
      {/* <CopilotTest /> */}
      <div className="w-full max-w-200 mx-auto">
        <ChatInput
          query={query}
          apps={apps}
          onQueryChange={setQuery}
          onSubmit={handleSubmit}
          loading={isSubmitting}
          selectedApp={selectedApp}
          onSelectedAppChange={setSelectedApp}
        />
      </div>
    </div>
  );
}
