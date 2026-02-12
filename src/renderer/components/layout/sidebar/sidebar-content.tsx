import type { CSSProperties, MouseEvent } from "react";
import ChatSessionList from "./chat-session-list";
import PostsList from "./post-list";
import WorkspacesList from "./workspace-list";
import type { ChatSession } from "@/lib/redux/api";
import { WorkspaceResponse } from "src/main/modules/workspaces";

interface JournalEntity {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  metadata: { status?: "draft" | "published" } | null;
  updatedAt: string;
  createdAt: string;
}

interface SidebarContentProps {
  itemType: "chat" | "post" | "workspace" | "claude";
  sessions: ChatSession[];
  entities: JournalEntity[];
  workspaces: WorkspaceResponse[];
  isLoadingSessions: boolean;
  isLoadingEntities: boolean;
  isLoadingWorkspaces: boolean;
  currentPath: string;
  onDeleteSession: (session: ChatSession, e: MouseEvent) => void;
  onDeletePost?: (postId: string, e: MouseEvent) => void;
  onDeleteWorkspace?: (workspaceId: string, e: MouseEvent) => void;
  onArchiveWorkspace?: (workspaceId: string) => void;
}

export function SidebarContent({
  itemType,
  sessions,
  entities,
  workspaces = [],
  isLoadingSessions,
  isLoadingEntities,
  isLoadingWorkspaces = false,
  currentPath,
  onDeleteSession,
  onDeletePost,
  onDeleteWorkspace,
  onArchiveWorkspace,
}: SidebarContentProps) {
  return (
    <div
      className="flex-1 overflow-y-auto noscrollbar px-4"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      <div
        key={itemType}
        style={{
          animation: "slide-fade-down 300ms ease-in-out",
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
              id: entity.id,
              url: entity.url,
              title: entity.title || "Untitled",
              description: entity.summary || "",
              status: entity.metadata?.status,
              updatedAt: entity.updatedAt,
              createdAt: entity.createdAt,
            }))}
            isLoading={isLoadingEntities}
            onDeletePost={onDeletePost}
          />
        )}
        {(itemType === "workspace") && (
          <WorkspacesList
            workspaces={workspaces}
            isLoading={isLoadingWorkspaces}
            onDeleteWorkspace={onDeleteWorkspace}
            onArchiveWorkspace={onArchiveWorkspace}
          />
        )}
      </div>
    </div>
  );
}
