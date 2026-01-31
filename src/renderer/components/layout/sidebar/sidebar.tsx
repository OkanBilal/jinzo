//import { useNavigate } from "react-router-dom";
import { SidebarHeader } from "./sidebar-header";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarContent } from "./sidebar-content";
import DeleteConfirmationModal from "./delete-confirmation-modal";
import NewButton from "./new-button";
//import CopilotButton from "./copilot-button";
import CreateMoodView from "./create-mood-view";
import PresetMoodsView from "./preset-moods-view";
import SettingsView from "./settings-view";
import CreateMoodMenu from "./create-mood-menu";
import MoodContextMenu from "./mood-context-menu";
import EditMoodModal from "./edit-mood-modal";
import DeleteMoodModal from "./delete-mood-modal";
import { useSidebar } from "./use-sidebar";

export default function Sidebar() {
  //const navigate = useNavigate();
  const {
    currentPath,
    searchQuery,
    isSearchExpanded,
    isSettingsOpen,
    isCreatingMood,
    isViewingPresetMoods,
    createMoodMenuState,
    contextMenuState,
    editModalState,
    deleteMoodState,
    account,
    sessions,
    entities,
    workspaces,
    apps,
    connectedApps,
    moods,
    activeMoodId,
    sidebarConfig,
    isLoadingSessions,
    isLoadingEntities,
    isLoadingWorkspaces,
    deleteSession,
    setSearchQuery,
    handleSearchExpand,
    handleSearchClear,
    handleMoodChange,
    handleNewClick,
    handleOpenSettings,
    handleCloseSettings,
    handleOpenCreateMoodMenu,
    handleCloseCreateMoodMenu,
    handleStartCreatingMood,
    handleStartViewingPresetMoods,
    handleStopCreatingMood,
    handleRefreshApps,
    handleMoodContextMenu,
    handleCloseContextMenu,
    handleEditMood,
    handleCloseEditModal,
    handleDeleteMood,
    handleConfirmDeleteMood,
    handleCancelDeleteMood,
    deleteJournalState,
    handleDeleteJournalClick,
    handleConfirmDeleteJournal,
    handleCancelDeleteJournal,
    deleteWorkspaceState,
    handleDeleteWorkspaceClick,
    handleConfirmDeleteWorkspace,
    handleCancelDeleteWorkspace,
  } = useSidebar();

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
                title={sidebarConfig.title}
                actionPrefix={sidebarConfig.itemType === "workspace" ? "Add" : sidebarConfig.itemType === "claude" ? "Add" : "New"}
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
              onDeletePost={handleDeleteJournalClick}
              onDeleteWorkspace={handleDeleteWorkspaceClick}
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
        isOpen={!!deleteJournalState.journalId}
        isDeleting={deleteJournalState.isDeleting}
        onConfirm={handleConfirmDeleteJournal}
        onCancel={handleCancelDeleteJournal}
        title="Delete Post?"
        description="This action cannot be undone. The post will be permanently deleted."
      />

      <DeleteConfirmationModal
        isOpen={!!deleteWorkspaceState.workspaceId}
        isDeleting={deleteWorkspaceState.isDeleting}
        onConfirm={handleConfirmDeleteWorkspace}
        onCancel={handleCancelDeleteWorkspace}
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
