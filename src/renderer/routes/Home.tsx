import { useState, useCallback } from "react";
import ChatInput from "@/features/chat/components/input";
import { AppState } from "@/features/chat/components/input/types";
import { useCreateChat } from "@/features/chat/hooks";
import { useGetAppsQuery } from "@/lib/redux/api";

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
    <div className="h-full w-full flex items-end justify-center px-8 pb-8">
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
