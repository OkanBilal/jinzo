import type { CSSProperties, MouseEvent } from "react";
import ChatSessionList from "./chat-session-list";
import PostsList from "./post-list";
import type { ChatSession, Entity } from "@/lib/redux/api";

interface SidebarContentProps {
  itemType: "chat" | "post";
  sessions: ChatSession[];
  entities: Entity[];
  isLoadingSessions: boolean;
  isLoadingEntities: boolean;
  currentPath: string;
  onDeleteSession: (session: ChatSession, e: MouseEvent) => void;
}

export function SidebarContent({
  itemType,
  sessions,
  entities,
  isLoadingSessions,
  isLoadingEntities,
  currentPath,
  onDeleteSession,
}: SidebarContentProps) {
  return (
    <div
      className="flex-1 overflow-y-auto noscrollbar px-4"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      <div
        key={itemType}
        className="animate-fadeIn"
        style={{
          animation: "fadeIn 300ms ease-in-out",
        }}
      >
        {itemType === "chat" && (
          <ChatSessionList
            sessions={sessions}
            isLoading={isLoadingSessions}
            currentPath={currentPath}
            onDeleteSession={onDeleteSession}
          />
        )}
        {itemType === "post" && (
          <PostsList
            posts={entities.map((entity) => ({
              url: entity.url,
              title: entity.title,
              description: entity.summary || "",
            }))}
            isLoading={isLoadingEntities}
          />
        )}
      </div>
    </div>
  );
}
