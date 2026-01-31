import { useState, useCallback } from "react";
import ChatInput from "@/features/chat/components/input";
import { useCreateChat } from "@/features/chat/hooks";
import LottieHero from "@/features/home/components/lottie-hero";

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
    <div className="h-full w-full flex flex-col px-8 relative">
      <div className="flex-1 flex items-center justify-center"></div>
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
