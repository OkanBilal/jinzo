import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SidebarHeader } from "./sidebar-header";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarContent } from "./sidebar-content";
import DeleteConfirmationModal from "./delete-confirmation-modal";
import NewButton from "./new-button";
import CreateSpaceView from "./create-space-view";
import PresetSpacesView from "./preset-spaces-view";
import SettingsView from "./settings-view";
import CreateSpaceMenu from "./create-space-menu";
import HelpMenu from "./help-menu";
import FeedbackModal from "./feedback-modal";
import SpaceContextMenu from "./space-context-menu";
import EditSpaceModal from "./edit-space-modal";
import DeleteSpaceModal from "./delete-space-modal";
import { Edit, Plus, Connect } from "@/components/ui/icons";
import CloneRepoModal from "./clone-repo-modal";
import { useDeleteChatSession } from "@/features/chat/hooks/use-delete-chat-session";
import { useDeleteJournal } from "@/features/journal/hooks";
import { useDeleteWorkspace } from "@/features/workspace/hooks";
import { useArchiveWorkspace } from "@/features/workspace/hooks";
import { useSpaceContextMenu } from "@/hooks/use-space-context-menu";
import { useSpaceMenu } from "@/hooks/use-space-menu";
import { useSidebarSearch } from "@/hooks/use-sidebar-search";
import { useSettingsNavigation } from "@/hooks/use-settings-navigation";
import { useSidebarData } from "@/hooks/use-sidebar-data";
import { useSidebarActions } from "@/hooks/use-sidebar-actions";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { useActiveSpace } from "@/hooks/use-active-space";

export default function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  const sidebarConfig = useSidebarConfig();
  const { spaces, activeSpaceId } = useActiveSpace();

  const {
    searchQuery,
    isSearchExpanded,
    setSearchQuery,
    handleSearchExpand,
    handleSearchClear,
  } = useSidebarSearch();

  const { isSettingsOpen, handleOpenSettings, handleCloseSettings } =
    useSettingsNavigation();

  const {
    isCreatingSpace,
    isViewingPresetSpaces,
    createSpaceMenuState,
    handleOpenCreateSpaceMenu,
    handleCloseCreateSpaceMenu,
    handleStartCreatingSpace,
    handleStartViewingPresetSpaces,
    handleStopCreatingSpace,
  } = useSpaceMenu();

  const {
    contextMenuState,
    editModalState,
    deleteSpaceState,
    handleSpaceContextMenu,
    handleCloseContextMenu,
    handleEditSpace,
    handleCloseEditModal,
    handleDeleteSpace,
    handleConfirmDeleteSpace,
    handleCancelDeleteSpace,
  } = useSpaceContextMenu();

  // Feedback modal state
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFeedbackOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Help menu state
  const [helpMenuState, setHelpMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({ isOpen: false, position: { x: 0, y: 0 } });

  const handleOpenHelpMenu = (event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setHelpMenuState({
      isOpen: true,
      position: { x: rect.right + 40, y: rect.bottom - 12 },
    });
  };

  const handleCloseHelpMenu = () => {
    setHelpMenuState({ isOpen: false, position: { x: 0, y: 0 } });
  };

  const {
    account,
    sessions,
    entities,
    workspaces,
    isLoadingSessions,
    isLoadingEntities,
    isLoadingWorkspaces,
    handleRefreshApps,
  } = useSidebarData({ searchQuery, sidebarConfig });

  const {
    handleSpaceChange,
    handleNewClick,
    handleAddProject,
    handleCloneRepo,
    handleOpenCloneModal,
    handleCloseCloneModal,
    isCloneModalOpen,
    isCloning,
  } = useSidebarActions();

  const deleteSession = useDeleteChatSession();
  const deleteJournal = useDeleteJournal();
  const deleteWorkspace = useDeleteWorkspace();
  const archiveWorkspace = useArchiveWorkspace();

  // Suppress unused variable warning for handleRefreshApps
  void handleRefreshApps;

  return (
    <>
      <aside
        className="fixed top-0 bottom-0 left-0 z-30 transition-all duration-300"
        style={{ width: sidebarConfig.width }}
        role="complementary"
        aria-label="Chat sessions sidebar"
      >
        {isSettingsOpen ? (
          <SettingsView onClose={handleCloseSettings} />
        ) : isCreatingSpace ? (
          <CreateSpaceView onClose={handleStopCreatingSpace} />
        ) : isViewingPresetSpaces ? (
          <PresetSpacesView onClose={handleStopCreatingSpace} />
        ) : (
          <div className="h-full overflow-hidden flex flex-col">
            <SidebarHeader
              avatarUrl={account?.avatarUrl}
              displayName={account?.displayName}
              isSearchExpanded={isSearchExpanded}
              searchQuery={searchQuery}
              onSearchExpand={handleSearchExpand}
              onSearchChange={setSearchQuery}
              onSearchClear={handleSearchClear}
            />
            <div className="p-3">
              <NewButton
                onClick={handleNewClick}
                icon={
                  sidebarConfig.itemType === "workspace" ? (
                    <Plus className="w-4 h-4 text-primary-900 dark:text-primary-100" />
                  ) : (
                    <Edit className="w-4 h-4 text-primary-900 dark:text-primary-100" />
                  )
                }
                title={sidebarConfig.title}
                actionPrefix={
                  sidebarConfig.itemType === "workspace" ? "Add" : "New"
                }
                dropdownItems={
                  sidebarConfig.itemType === "workspace"
                    ? [
                        {
                          label: "Add local repository",
                          icon: (
                            <Plus className="w-3.5 h-3.5 text-primary-800 dark:text-primary-200" />
                          ),
                          onClick: handleAddProject,
                        },
                        {
                          label: "Clone from URL",
                          icon: (
                            <Connect className="w-3.5 h-3.5 text-primary-800 dark:text-primary-200" />
                          ),
                          onClick: handleOpenCloneModal,
                        },
                      ]
                    : undefined
                }
              />
            </div>
            <SidebarContent
              itemType={sidebarConfig.itemType}
              sessions={sessions}
              entities={entities}
              workspaces={workspaces}
              isLoadingSessions={isLoadingSessions}
              isLoadingEntities={isLoadingEntities}
              isLoadingWorkspaces={isLoadingWorkspaces}
              currentPath={currentPath}
              onDeleteSession={deleteSession.handleDeleteClick}
              onDeletePost={deleteJournal.handleDeleteClick}
              onDeleteWorkspace={deleteWorkspace.handleDeleteClick}
              onArchiveWorkspace={archiveWorkspace.handleArchiveClick}
            />
            <SidebarFooter
              spaces={spaces}
              activeSpaceId={activeSpaceId}
              onSpaceChange={handleSpaceChange}
              onSpaceContextMenu={handleSpaceContextMenu}
              onSettingsClick={handleOpenSettings}
              onPlusClick={handleOpenCreateSpaceMenu}
              onHelpClick={handleOpenHelpMenu}
            />
          </div>
        )}
      </aside>

      <DeleteConfirmationModal
        isOpen={!!deleteSession.sessionToDelete}
        isDeleting={deleteSession.isDeleting}
        onConfirm={deleteSession.handleConfirmDelete}
        onCancel={deleteSession.handleCancelDelete}
      />

      <DeleteConfirmationModal
        isOpen={!!deleteJournal.journalToDelete}
        isDeleting={deleteJournal.isDeleting}
        onConfirm={deleteJournal.handleConfirmDelete}
        onCancel={deleteJournal.handleCancelDelete}
        title="Delete Post?"
        description="This action cannot be undone. The post will be permanently deleted."
      />

      <DeleteConfirmationModal
        isOpen={!!deleteWorkspace.workspaceToDelete}
        isDeleting={deleteWorkspace.isDeleting}
        onConfirm={deleteWorkspace.handleConfirmDelete}
        onCancel={deleteWorkspace.handleCancelDelete}
        title="Delete Workspace?"
        description="This action cannot be undone. The workspace will be permanently deleted."
      />

      <SpaceContextMenu
        isOpen={contextMenuState.isOpen}
        position={contextMenuState.position}
        space={contextMenuState.targetSpace}
        onEdit={handleEditSpace}
        onDelete={handleDeleteSpace}
        onClose={handleCloseContextMenu}
      />

      <EditSpaceModal
        isOpen={editModalState.isOpen}
        space={editModalState.space}
        onClose={handleCloseEditModal}
        sidebarWidth={sidebarConfig.width}
      />

      <DeleteSpaceModal
        space={deleteSpaceState.space}
        isDeleting={deleteSpaceState.isDeleting}
        onConfirm={handleConfirmDeleteSpace}
        onCancel={handleCancelDeleteSpace}
      />

      <CreateSpaceMenu
        isOpen={createSpaceMenuState.isOpen}
        position={createSpaceMenuState.position}
        onCreateSpace={handleStartCreatingSpace}
        onPresetSpaces={handleStartViewingPresetSpaces}
        onClose={handleCloseCreateSpaceMenu}
      />

      <HelpMenu
        isOpen={helpMenuState.isOpen}
        position={helpMenuState.position}
        onClose={handleCloseHelpMenu}
        onFeedback={() => setFeedbackOpen(true)}
      />

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />

      <CloneRepoModal
        isOpen={isCloneModalOpen}
        isCloning={isCloning}
        onClone={handleCloneRepo}
        onClose={handleCloseCloneModal}
      />
    </>
  );
}
