import { useCallback, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import ChatInput from "../features/chat/components/input";
import { AppState } from "../features/chat/components/input/types";
import { useCreatePrompts } from "../features/home/hooks/use-create-prompts";
import {
  useCreateChatSessionMutation,
  useGetAppsQuery,
} from "../lib/redux/api";
import { useAppSelector } from "../lib/redux/hooks";
import { useActiveMood } from "../hooks/useActiveMood";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function HomePage() {
  const { data: apps = [] } = useGetAppsQuery();
  const [createChatSession] = useCreateChatSessionMutation();
  const model = useAppSelector((state) => state.chat.selectedModel);
  const { isJournalMood } = useActiveMood();

  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: "heading",
        content: "New Post",
      },
      {
        type: "paragraph",
        content: "Welcome to Journal Mood ✍️",
      },
      {
        type: "paragraph",
        content: "Start writing your thoughts here...",
      },
    ],
  });

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
        navigate(`/chat/${sessionId}`);
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
    <>
      {isJournalMood ? (
        <div className=" w-full py-12 px-6">
          <BlockNoteView editor={editor} theme="dark" data-theming-css-demo />
        </div>
      ) : (
        <div
          className={`h-full w-full flex items-end justify-center px-8 pb-8`}
        >
          <div className="w-full max-w-200 mx-auto">
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
      )}
    </>
  );
}
