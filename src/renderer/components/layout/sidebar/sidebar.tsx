import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
import { useCapabilities, useIsMobile } from "@/lib/platform";
import SpaceContextMenu from "./space-context-menu";
import EditSpaceModal from "./edit-space-modal";
import DeleteSpaceModal from "./delete-space-modal";
import {
  Edit,
  Plus,
  Connect,
  Apps,
  Project,
  Sun,
  Relay,
} from "@/components/ui/icons";
import CloneRepoModal from "./clone-repo-modal";
import CreateProjectModal from "./create-project-modal";
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
import { useScriptNotifications } from "@/hooks/use-script-notifications";
import { useSidebarSpaceSwipe } from "@/hooks/use-sidebar-space-swipe";
import { UpdateBanner } from "./update-banner";
import { Button } from "@/components/ui/button";
import { Body, Tooltip } from "@/components/ui";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { useAppSelector, useAppDispatch } from "@/lib/redux/hooks";
import { setSidebarWidth } from "@/lib/redux/slices/appSettingsSlice";
import { setLayoutWidthVar } from "@/hooks/use-layout-width-vars";
import {
  SIDEBAR_WIDTH_VAR,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_DEFAULT,
} from "@/lib/layout";

interface SidebarProps {
  collapsed?: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const sidebarWidth = useAppSelector((s) => s.appSettings.sidebarWidth);
  const sidebarConfig = useSidebarConfig();
  const { spaces, activeSpaceId, activeSpaceAgentSlug } =
    useActiveSpace();

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

  // Global listeners
  useScriptNotifications();

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

  const { account, workspaces, isLoadingWorkspaces, handleRefreshConnections } =
    useSidebarData({ searchQuery, sidebarConfig });
  // Picking a local folder uses a native dialog, which can't run from the web
  // client (it would open on the headless backend). Hide the folder-picker entry.
  const { nativeDialogs } = useCapabilities();
  const isMobile = useIsMobile();

  const {
    handleSpaceChange,
    handleNewClick,
    handleAddProject,
    handleCloneRepo,
    handleOpenCloneModal,
    handleCloseCloneModal,
    isCloneModalOpen,
    isCloning,
    handleCreateProject,
    handleOpenCreateProjectModal,
    handleCloseCreateProjectModal,
    isCreateProjectModalOpen,
    isCreatingProject,
  } = useSidebarActions();

  const deleteWorkspace = useDeleteWorkspace();
  const archiveWorkspace = useArchiveWorkspace();

  const swipeRef = useSidebarSpaceSwipe({
    spaces,
    activeSpaceId,
    onSpaceChange: handleSpaceChange,
  });

  // Suppress unused variable warning for handleRefreshConnections
  void handleRefreshConnections;

  const isPluginsRoute =
    location.pathname === "/plugins" ||
    location.pathname.startsWith("/plugins/");
  const isPulseRoute =
    location.pathname === "/pulse" || location.pathname.startsWith("/pulse/");
  const isRelayRoute =
    location.pathname === "/relay" ||
    location.pathname.startsWith("/relay/");
  /** Copilot/Cursor drivers don't implement the plugin API yet. */
  const isPluginsDisabledForAgent =
    activeSpaceAgentSlug === "copilot" ||
    activeSpaceAgentSlug === "cursor";

  return (
    <>
      <aside
        ref={swipeRef}
        className={`fixed top-0 bottom-0 left-0 z-(--z-sidebar) transition-all duration-300 ${
          isMobile ? "bg-primary dark:bg-primary-950 shadow-2xl" : ""
        }`}
        style={{
          width: isMobile ? "100%" : "var(--sidebar-width)",
          transform: collapsed ? "translateX(-100%)" : "translateX(0)",
          opacity: collapsed ? 0 : 1,
        }}
        role="complementary"
        aria-label="Workspace sidebar"
      >
        {/* <SpaceSwitchIndicator activeSpace={activeSpace} /> */}
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
            <div className="px-3 py-px">
              <NewButton
                onClick={handleNewClick}
                icon={
                  sidebarConfig.itemType === "workspace" ? (
                    <Project className="size-3.5 text-primary-900 dark:text-primary-100" />
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
                        ...(nativeDialogs
                          ? [
                              {
                                label: "Add from local",
                                icon: (
                                  <Plus className="w-3.5 h-3.5 text-primary-800 dark:text-primary-200" />
                                ),
                                shortcut: "o",
                                shortcutLabel: "\u2318\u21e7O",
                                onClick: handleAddProject,
                              },
                            ]
                          : []),
                        {
                          label: "Clone from URL",
                          icon: (
                            <Connect className="w-3.5 h-3.5 text-primary-800 dark:text-primary-200" />
                          ),
                          shortcut: "u",
                          shortcutLabel: "\u2318\u21e7U",
                          onClick: handleOpenCloneModal,
                        },
                        {
                          label: "Create new project",
                          icon: (
                            <Project className="w-3.5 h-3.5 text-primary-800 dark:text-primary-200" />
                          ),
                          shortcut: "n",
                          shortcutLabel: "\u2318\u21e7N",
                          onClick: handleOpenCreateProjectModal,
                        },
                      ]
                    : undefined
                }
              />
            </div>
            <div className="px-3 mb-px">
              <Button
                variant="subtle"
                tooltip="View your pulse"
                size="xs"
                className={`justify-start flex items-center gap-2 w-full rounded-xl transition-colors ${
                  isPulseRoute
                    ? "bg-primary/50 dark:bg-primary/5 hover:bg-primary/90 dark:hover:bg-primary/10"
                    : ""
                }`}
                onClick={() => navigate("/pulse")}
                aria-current={isPulseRoute ? "page" : undefined}
              >
                <Sun
                  className={`w-4 h-4 -ml-1 ${
                    isPulseRoute
                      ? "text-primary-950 dark:text-primary"
                      : "text-primary-900 dark:text-primary-200"
                  }`}
                />
                <Body
                  className={`text-s font-normal ${
                    isPulseRoute
                      ? "text-primary-950 dark:text-primary"
                      : "text-primary-900 dark:text-primary-100"
                  }`}
                >
                  Pulse
                </Body>
              </Button>
            </div>
            <div className="px-3 mb-px">
              {isPluginsDisabledForAgent ? (
                <Tooltip
                  content="Not available for this agent yet."
                  position="top"
                >
                  <span className="block w-full">
                    <Button
                      variant="subtle"
                      size="xs"
                      tooltip={`${isPluginsDisabledForAgent ? "Not available for this agent yet.": "View plugins"}`}
                      disabled
                      className={`justify-start flex items-center gap-2 w-full rounded-xl transition-colors pointer-events-none opacity-50 ${
                        isPluginsRoute
                          ? "bg-primary/50 dark:bg-primary/5"
                          : ""
                      }`}
                      aria-current={isPluginsRoute ? "page" : undefined}
                    >
                      <Apps
                        className={`w-4 h-4 -ml-1 ${
                          isPluginsRoute
                            ? "text-primary-950 dark:text-primary"
                            : "text-primary-900 dark:text-primary-200"
                        }`}
                      />
                      <Body
                        className={`text-s flex-1 font-normal text-left ${
                          isPluginsRoute
                            ? "text-primary-950 dark:text-primary"
                            : "text-primary-900 dark:text-primary-100"
                        }`}
                      >
                        Plugins
                      </Body>
                    </Button>
                  </span>
                </Tooltip>
              ) : (
                <Button
                  variant="subtle"
                  tooltip="View plugins"
                  size="xs"
                  className={`justify-start flex items-center gap-2 w-full rounded-xl transition-colors ${
                    isPluginsRoute
                      ? "bg-primary/50 dark:bg-primary/5 hover:bg-primary/90 dark:hover:bg-primary/10"
                      : ""
                  }`}
                  onClick={() => {
                    navigate("/plugins");
                  }}
                  aria-current={isPluginsRoute ? "page" : undefined}
                >
                  <Apps
                    className={`w-4 h-4 -ml-1 shrink-0 ${
                      isPluginsRoute
                        ? "text-primary-950 dark:text-primary"
                        : "text-primary-900 dark:text-primary-200"
                    }`}
                  />
                  <Body
                    className={`text-s font-normal flex-1 text-left ${
                      isPluginsRoute
                        ? "text-primary-950 dark:text-primary"
                        : "text-primary-900 dark:text-primary-100"
                    }`}
                  >
                    Plugins
                  </Body>
                </Button>
              )}
            </div>

            <div className="px-3 mb-2">
              <Button
                variant="subtle"
                tooltip="Relay"
                size="xs"
                className={`justify-start flex items-center gap-2 w-full rounded-xl transition-colors ${
                  isRelayRoute
                    ? "bg-primary/50 dark:bg-primary/5 hover:bg-primary/90 dark:hover:bg-primary/10"
                    : ""
                }`}
                onClick={() => navigate("/relay")}
                aria-current={isRelayRoute ? "page" : undefined}
              >
                <Relay
                  className={`w-4 h-4 -ml-1 shrink-0 ${
                    isRelayRoute
                      ? "text-primary-950 dark:text-primary"
                      : "text-primary-900 dark:text-primary-200"
                  }`}
                />
                <Body
                  className={`text-s font-normal flex-1 text-left ${
                    isRelayRoute
                      ? "text-primary-950 dark:text-primary"
                      : "text-primary-900 dark:text-primary-100"
                  }`}
                >
                  Relay
                </Body>
                <span
                  className={`shrink-0 text-[10px] -mr-1 uppercase px-1.5 py-px rounded-md ${
                    isRelayRoute
                      ? "bg-primary-400/20 text-primary-800 dark:bg-primary/5 dark:text-primary"
                      : "bg-primary-400/20 text-primary-600 dark:bg-primary/5 dark:text-primary-200"
                  }`}
                >
                  Beta
                </span>
              </Button>
            </div>
            <SidebarContent
              workspaces={workspaces}
              isLoadingWorkspaces={isLoadingWorkspaces}
              onDeleteWorkspace={deleteWorkspace.handleDeleteClick}
              onArchiveWorkspace={archiveWorkspace.handleArchiveClick}
            />
            <UpdateBanner />
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
        {!collapsed && (
          <ResizeHandle
            edge="right"
            value={sidebarWidth}
            min={SIDEBAR_WIDTH_MIN}
            max={SIDEBAR_WIDTH_MAX}
            computeWidth={(clientX) => clientX}
            onPreview={(w) => setLayoutWidthVar(SIDEBAR_WIDTH_VAR, w)}
            onCommit={(w) => dispatch(setSidebarWidth(w))}
            onReset={() => dispatch(setSidebarWidth(SIDEBAR_WIDTH_DEFAULT))}
            ariaLabel="Resize sidebar"
          />
        )}
      </aside>

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
        sidebarWidth="var(--sidebar-width)"
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
      />

      <CloneRepoModal
        isOpen={isCloneModalOpen}
        isCloning={isCloning}
        onClone={handleCloneRepo}
        onClose={handleCloseCloneModal}
      />

      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        isCreating={isCreatingProject}
        onCreate={handleCreateProject}
        onClose={handleCloseCreateProjectModal}
      />
    </>
  );
}
