import { useLocation } from "react-router-dom";
import { SidebarHeader } from "./sidebar-header";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarContent } from "./sidebar-content";
import DeleteConfirmationModal from "./delete-confirmation-modal";
import NewButton from "./new-button";
import CreateMoodView from "./create-mood-view";
import PresetMoodsView from "./preset-moods-view";
import SettingsView from "./settings-view";
import CreateMoodMenu from "./create-mood-menu";
import MoodContextMenu from "./mood-context-menu";
import EditMoodModal from "./edit-mood-modal";
import DeleteMoodModal from "./delete-mood-modal";
import { Edit, Plus } from "@/components/ui/icons";
import { useDeleteChatSession } from "@/features/chat/hooks/use-delete-chat-session";
import { useDeleteJournal } from "@/features/journal/hooks";
import { useDeleteWorkspace } from "@/features/workspace/hooks";
import { useArchiveWorkspace } from "@/features/workspace/hooks";
import { useMoodContextMenu } from "@/hooks/use-mood-context-menu";
import { useMoodMenu } from "@/hooks/use-mood-menu";
import { useSidebarSearch } from "@/hooks/use-sidebar-search";
import { useSettingsNavigation } from "@/hooks/use-settings-navigation";
import { useSidebarData } from "@/hooks/use-sidebar-data";
import { useSidebarActions } from "@/hooks/use-sidebar-actions";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { useActiveMood } from "@/hooks/use-active-mood";

export default function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  const sidebarConfig = useSidebarConfig();
  const { moods, activeMoodId } = useActiveMood();

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
    isCreatingMood,
    isViewingPresetMoods,
    createMoodMenuState,
    handleOpenCreateMoodMenu,
    handleCloseCreateMoodMenu,
    handleStartCreatingMood,
    handleStartViewingPresetMoods,
    handleStopCreatingMood,
  } = useMoodMenu();

  const {
    contextMenuState,
    editModalState,
    deleteMoodState,
    handleMoodContextMenu,
    handleCloseContextMenu,
    handleEditMood,
    handleCloseEditModal,
    handleDeleteMood,
    handleConfirmDeleteMood,
    handleCancelDeleteMood,
  } = useMoodContextMenu();

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

  const { handleMoodChange, handleNewClick } = useSidebarActions();

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
        ) : isCreatingMood ? (
          <CreateMoodView onClose={handleStopCreatingMood} />
        ) : isViewingPresetMoods ? (
          <PresetMoodsView onClose={handleStopCreatingMood} />
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
            <div className="px-4 py-3">
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
              moods={moods}
              activeMoodId={activeMoodId}
              onMoodChange={handleMoodChange}
              onMoodContextMenu={handleMoodContextMenu}
              onSettingsClick={handleOpenSettings}
              onPlusClick={handleOpenCreateMoodMenu}
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

      <MoodContextMenu
        isOpen={contextMenuState.isOpen}
        position={contextMenuState.position}
        mood={contextMenuState.targetMood}
        onEdit={handleEditMood}
        onDelete={handleDeleteMood}
        onClose={handleCloseContextMenu}
      />

      <EditMoodModal
        isOpen={editModalState.isOpen}
        mood={editModalState.mood}
        onClose={handleCloseEditModal}
        sidebarWidth={sidebarConfig.width}
      />

      <DeleteMoodModal
        mood={deleteMoodState.mood}
        isDeleting={deleteMoodState.isDeleting}
        onConfirm={handleConfirmDeleteMood}
        onCancel={handleCancelDeleteMood}
      />

      <CreateMoodMenu
        isOpen={createMoodMenuState.isOpen}
        position={createMoodMenuState.position}
        onCreateMood={handleStartCreatingMood}
        onPresetMoods={handleStartViewingPresetMoods}
        onClose={handleCloseCreateMoodMenu}
      />
    </>
  );
}
