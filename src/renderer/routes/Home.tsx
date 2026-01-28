import { useState, useCallback } from "react";
import ChatInput from "@/features/chat/components/input";
import { useCreateChat } from "@/features/chat/hooks";

export default function HomePage() {
  const { createChat, isSubmitting } = useCreateChat();

  const [query, setQuery] = useState("");

  const handleSubmit = useCallback(
    (overrideText?: string) => {
      createChat(overrideText ?? query);
    },
    [query, createChat],
  );

  return (
    <div className="h-full w-full flex items-end justify-center px-8  relative">
      <div className="w-full max-w-200 mx-auto mb-4">
        <ChatInput
          query={query}
          onQueryChange={setQuery}
          onSubmit={handleSubmit}
          loading={isSubmitting}
        />
      </div>
    </div>
  );
}
