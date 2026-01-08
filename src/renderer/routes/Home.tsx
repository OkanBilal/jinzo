"use client";

import { useCallback, useState } from "react";
import LottieHero from "../features/home/components/lottie-hero";
import PromptMarquee from "../features/home/components/prompt-marquee";
import WelcomeHeader from "../features/home/components/welcome-header";
import ChatInput from "../features/chat/components/input";
import { AppState } from "../features/chat/components/input/types";
import { useCreatePrompts } from "../features/home/hooks/use-create-prompts";
import { useCreateChatSessionMutation, useGetAppsQuery } from "../lib/redux/api";
import { useAppSelector } from "../lib/redux/hooks";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function HomePage() {
  const { data: apps = [] } = useGetAppsQuery();
  const [createChatSession] = useCreateChatSessionMutation();
  const model = useAppSelector((state) => state.chat.selectedModel);

  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [isLeaving, setIsLeaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (overrideText?: string) => {
      const value = overrideText ?? query;
      if (!value) {
        toast.error("Please enter a query");
        return;
      }
      try {
        setSubmitting(true);
        const { sessionId } = await createChatSession({
          question: value,
          model,
        }).unwrap();
        if (!sessionId) {
          toast.error("Failed to create chat session");
          return;
        }
        setIsLeaving(true);
        setTimeout(() => navigate(`/chat/${sessionId}`), 20);
      } catch {
        toast.error("Couldn't create chat session. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [query, model, createChatSession, navigate]
  );

  const [selectedApp, setSelectedApp] = useState<AppState | null>(null);

  //const prompts = useCreatePrompts(selectedApp?.id);

  // const handlePromptSelect = (label: string) => {
  //   if (selectedApp) {
  //     setQuery(`@${selectedApp.displayName} ${label}`);
  //   } else {
  //     setQuery(label);
  //   }
  // };

  return (
    <div
      className={`min-h-screen  w-full flex items-center justify-center px-4 pb-40 transition-all duration-300 ${
        isLeaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      }`}
    >
      <div className="w-full flex flex-col items-center gap-6">
        <div className="w-full max-w-200 flex flex-col items-center gap-6">
          {/* <LottieHero /> */}
          <WelcomeHeader />
          <ChatInput
            query={query}
            apps={apps}
            onQueryChange={setQuery}
            onSubmit={handleSubmit}
            loading={submitting}
            selectedApp={selectedApp}
            onSelectedAppChange={setSelectedApp}
          />
          {/* <PromptMarquee prompts={prompts} onSelect={handlePromptSelect} /> */}
        </div>
      </div>
    </div>
  );
}
