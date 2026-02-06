import { useState } from "react";
import { Caption } from "@/components/ui/text";
import { ArrowUp } from "@/components/ui/icons";
import { ChatSession } from "@/lib/redux/api";
import ChatSessionItem from "./chat-session-item";
import { Button } from "@/components/ui/button";

interface ChatSessionListProps {
  sessions: ChatSession[];
  isLoading: boolean;
  currentPath: string;
  onDeleteSession: (session: ChatSession, e: React.MouseEvent) => void;
}

export default function ChatSessionList({
  sessions,
  isLoading,
  currentPath,
  onDeleteSession,
}: ChatSessionListProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Caption className="text-primary-800 dark:text-primary-500">
          Loading...
        </Caption>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Caption className="text-primary-800 dark:text-primary-100!">
          No conversations yet
        </Caption>
      </div>
    );
  }

  return (
    <div className="pb-3">
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between active:scale-99 transition-all duration-200 bg-transparent 
        hover:bg-primary/10 dark:hover:bg-primary/5 cursor-pointer px-2 py-2 mb-1 rounded-lg "
      >
        <Caption className="text-primary-800 dark:text-primary-300! font-medium ">
          Chat
        </Caption>
        <ArrowUp
          className={`w-4 h-4 text-primary-800 dark:text-primary-300 transition-transform duration-150 ease-in-out ${
            isExpanded ? "rotate-180" : "rotate-90"
          }`}
        />
      </Button>

      {isExpanded && (
        <div className="flex flex-col space-y-1">
          {sessions.map((session, index) => {
            const isActive = currentPath === `/chat/${session.id}`;
            return (
              <div
                key={session.id}
                className="animate-slide-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <ChatSessionItem
                  session={session}
                  isActive={isActive}
                  onDelete={onDeleteSession}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
