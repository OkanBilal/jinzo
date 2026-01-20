import SettingsModal from "@/features/settings/components/settings-modal";
import { SidebarHeader } from "./sidebar-header";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarContent } from "./sidebar-content";
import DeleteConfirmationModal from "./delete-confirmation-modal";
import NewButton from "./new-button";
import CreateMoodView from "./create-mood-view";
import { useSidebar } from "./use-sidebar";

export default function FrostedSidebar() {
  const {
    currentPath,
    searchQuery,
    isSearchExpanded,
    isSettingsOpen,
    isCreatingMood,
    account,
    sessions,
    entities,
    apps,
    connectedApps,
    moods,
    activeMoodId,
    sidebarConfig,
    isLoadingSessions,
    isLoadingEntities,
    deleteSession,
    setSearchQuery,
    handleSearchExpand,
    handleSearchClear,
    handleMoodChange,
    handleNewClick,
    handleOpenSettings,
    handleCloseSettings,
    handleStartCreatingMood,
    handleStopCreatingMood,
    handleRefreshApps,
  } = useSidebar();

  return (
    <>
      <aside
        className="fixed top-0 bottom-0 left-0 z-30 transition-all duration-300"
        style={{ width: sidebarConfig.width }}
        role="complementary"
        aria-label="Chat sessions sidebar"
      >
        {isCreatingMood ? (
          <CreateMoodView onClose={handleStopCreatingMood} />
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

            <div className="p-4">
              <NewButton onClick={handleNewClick} title={sidebarConfig.title} />
            </div>

            <SidebarContent
              itemType={sidebarConfig.itemType}
              sessions={sessions}
              entities={entities}
              isLoadingSessions={isLoadingSessions}
              isLoadingEntities={isLoadingEntities}
              currentPath={currentPath}
              onDeleteSession={deleteSession.handleDeleteClick}
            />

            <SidebarFooter
              moods={moods}
              activeMoodId={activeMoodId}
              onMoodChange={handleMoodChange}
              onSettingsClick={handleOpenSettings}
              onCreateMoodClick={handleStartCreatingMood}
            />
          </div>
        )}
      </aside>

      <SettingsModal
        open={isSettingsOpen}
        apps={apps}
        connectedApps={connectedApps}
        onClose={handleCloseSettings}
        section={"general"}
        onRefresh={handleRefreshApps}
      />

      <DeleteConfirmationModal
        isOpen={!!deleteSession.sessionToDelete}
        isDeleting={deleteSession.isDeleting}
        onConfirm={deleteSession.handleConfirmDelete}
        onCancel={deleteSession.handleCancelDelete}
      />
    </>
  );
}
