import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/toast";
import { useCreateChatSessionMutation } from "@/lib/redux/api";
import { useAppSelector } from "@/lib/redux/hooks";

export function useCreateChat() {
  const navigate = useNavigate();
  const [createChatSession] = useCreateChatSessionMutation();
  const model = useAppSelector((state) => state.chat.selectedModel);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const createChat = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        toast.error("Please enter a query");
        return;
      }

      try {
        setIsSubmitting(true);
        const { sessionId } = await createChatSession({
          question: query,
          model,
        }).unwrap();

        if (!sessionId) {
          toast.error("Failed to create chat session");
          return;
        }

        navigate(`/chat/${sessionId}`);
      } catch {
        toast.error("Couldn't create chat session. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [model, createChatSession, navigate]
  );

  return {
    createChat,
    isSubmitting,
  };
}
