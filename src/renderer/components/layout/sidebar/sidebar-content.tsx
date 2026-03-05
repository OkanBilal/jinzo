import type { CSSProperties, MouseEvent } from "react";
import ChatSessionList from "./chat-session-list";
import WorkspacesList from "./workspace-list";
import type { ChatSession } from "@/lib/redux/api";
import { WorkspaceResponse } from "src/main/modules/workspaces";

const EMPTY_WORKSPACES: WorkspaceResponse[] = [];

interface SidebarContentProps {
  itemType: "chat" | "workspace" | "claude";
  sessions: ChatSession[];
  workspaces: WorkspaceResponse[];
  isLoadingSessions: boolean;
  isLoadingWorkspaces: boolean;
  currentPath: string;
  onDeleteSession: (session: ChatSession, e: MouseEvent) => void;
  onDeleteWorkspace?: (workspaceId: string, e: MouseEvent) => void;
  onArchiveWorkspace?: (workspaceId: string) => void;
}

export function SidebarContent({
  itemType,
  sessions,
  workspaces = EMPTY_WORKSPACES,
  isLoadingSessions,
  isLoadingWorkspaces = false,
  currentPath,
  onDeleteSession,
  onDeleteWorkspace,
  onArchiveWorkspace,
}: SidebarContentProps) {
  return (
    <div
      className="flex-1 overflow-y-auto noscrollbar px-3"
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
        {itemType === "workspace" && (
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
