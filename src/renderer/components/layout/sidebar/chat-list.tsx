import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { Button, Text, toast } from "@/components/ui";
import { Plus } from "@/components/ui/icons";
import {
  useArchiveRunMutation,
  useGetAccountQuery,
  useListCollectionsQuery,
  useMoveRunToCollectionMutation,
  useSetActiveSpaceMutation,
  type Collection,
  type RecentRun,
} from "@/lib/redux/api";
import {
  openNewRunTab,
  setPendingRunId,
  setSelectedCollectionId,
} from "@/lib/redux/slices/workspaceSlice";
import { useActiveSpace } from "@/hooks/use-active-space";
import { resolveRunSpaceId } from "@/features/workspace/lib/background-runs";
import { getProviderVariantById } from "@/lib/provider-variants";
import { WORKSPACE_BASE_PATH } from "@/lib/route-utils";
import { SidebarGroupSection } from "./sidebar-group-section";
import { ChatItem, chatLabel } from "./chat-item";
import { ProjectIcon } from "./project-icon";
import { useRecentChats } from "./use-recent-chats";
import { CollectionSourcesModal } from "./collection-sources-modal";

/** How many rows the flat Recents section shows. */
const RECENTS_LIMIT = 20;

interface SidebarChatListProps {
  searchQuery: string;
  onNewChatInCollection: (collectionId: string) => void;
  onCreateCollection: () => void;
}

/**
 * The chat shell's sidebar list (work/chat modes): Projects — collapsible,
 * chats inside — over a flat Recents section, ChatGPT-style. Chats are runs
 * of the active account/provider/mode. Collection membership groups them;
 * standalone runs remain available in Recents.
 */
export function SidebarChatList({
  searchQuery,
  onNewChatInCollection,
  onCreateCollection,
}: SidebarChatListProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { spaces, activeSpaceId } = useActiveSpace();
  const { data: account } = useGetAccountQuery();
  const [setActiveSpace] = useSetActiveSpaceMutation();
  const [archiveRun] = useArchiveRunMutation();
  const [moveRunToCollection] = useMoveRunToCollectionMutation();
  const [sourcesCollection, setSourcesCollection] =
    useState<Collection | null>(null);

  const activeTab = useAppSelector((state) => state.workspace.activeTab);
  const { data: recentRuns, isLoading } = useRecentChats();
  const { data: collections } = useListCollectionsQuery(
    { accountId: account?.id ?? "" },
    { skip: !account },
  );

  const query = searchQuery.trim().toLowerCase();
  const runs = useMemo(() => {
    const all = recentRuns ?? [];
    if (!query) return all;
    return all.filter((run) => chatLabel(run).toLowerCase().includes(query));
  }, [recentRuns, query]);

  // Project chats already render inside their collection group. Recents is the
  // flat home for standalone chats only, so a run never appears in both places.
  const standaloneRuns = useMemo(
    () => runs.filter((run) => run.collectionId === null),
    [runs],
  );

  const runsByCollection = useMemo(() => {
    const map = new Map<string, RecentRun[]>();
    for (const run of runs) {
      if (!run.collectionId) continue;
      const bucket = map.get(run.collectionId);
      if (bucket) bucket.push(run);
      else map.set(run.collectionId, [run]);
    }
    return map;
  }, [runs]);

  const collectionRows = useMemo(() => {
    const rows = (collections ?? []).filter((collection) => !collection.isArchived);
    // While searching, only Collections with matching chats (or a matching name)
    // stay visible.
    const filtered = query
      ? rows.filter(
          (collection) =>
            collection.name.toLowerCase().includes(query) ||
            (runsByCollection.get(collection.id)?.length ?? 0) > 0,
        )
      : rows;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [collections, query, runsByCollection]);

  const handleSelectChat = async (run: RecentRun) => {
    dispatch(setSelectedCollectionId(run.collectionId));

    // The page shows one provider at a time — a chat from another provider's
    // space needs the space switch first, same flow as the background dock.
    const targetSpaceId = resolveRunSpaceId(run, spaces, activeSpaceId || null);
    if (!targetSpaceId) {
      toast.error("No space is set up for this chat's agent");
      return;
    }
    const needsSpaceSwitch = targetSpaceId !== activeSpaceId;
    if (needsSpaceSwitch) {
      try {
        navigate("/", { replace: true });
        await setActiveSpace(targetSpaceId).unwrap();
      } catch (error) {
        console.error("Failed to switch space for chat:", error);
        toast.error("Failed to switch space");
        return;
      }
    }

    // Set the one-shot request only after the target space is known and any
    // switch succeeded; a failed jump must not open this run later by surprise.
    dispatch(setPendingRunId(run.id));
    const targetPath = `${WORKSPACE_BASE_PATH}/runs/${run.id}`;
    if (!needsSpaceSwitch && location.pathname === targetPath) {
      return;
    }
    navigate(targetPath);
  };

  const handleArchive = async (run: RecentRun) => {
    try {
      await archiveRun(run.id).unwrap();
      if (activeTab === run.id) {
        navigate(WORKSPACE_BASE_PATH);
        dispatch(openNewRunTab());
      }
    } catch (error) {
      console.error("Failed to archive chat:", error);
      toast.error("Failed to delete chat");
    }
  };

  const handleMove = async (
    run: RecentRun,
    collectionId: string | null,
  ) => {
    if (!account) return;
    try {
      await moveRunToCollection({
        runId: run.id,
        accountId: account.id,
        collectionId,
      }).unwrap();
      if (activeTab === run.id) {
        dispatch(setSelectedCollectionId(collectionId));
      }
    } catch (error) {
      console.error("Failed to move chat:", error);
      toast.error("Failed to move chat");
    }
  };

  const renderChat = (run: RecentRun, isRecent = false) => (
    <ChatItem
      key={run.id}
      run={run}
      variant={getProviderVariantById(run.providerId)?.variant ?? "null"}
      isActive={activeTab === run.id}
      isRecent={isRecent}
      onSelect={() => void handleSelectChat(run)}
      onArchive={() => void handleArchive(run)}
      collections={collections ?? []}
      onMove={(collectionId) => void handleMove(run, collectionId)}
    />
  );

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <Text as="span" size="xs" tone="muted">
          Loading…
        </Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-2">
      {(collectionRows.length > 0 || !query) && (
        <div>
          <div className="flex items-center px-2 py-1">
            <Text as="span" size="xs" tone="secondary" weight="medium">
              Projects
            </Text>
            <Button
              tooltip="Create project"
              aria-label="Create project"
              onClick={onCreateCollection}
              className="ml-auto p-0.5 rounded-md"
            >
              <Plus className="size-3 -mr-px text-primary-800 dark:text-primary-200" />
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {collectionRows.map((collection: Collection) => {
              const collectionRuns = runsByCollection.get(collection.id) ?? [];
              return (
                <SidebarGroupSection
                  key={collection.id}
                  groupKey={`collection-${collection.id}`}
                  label={collection.name}
                  icon={
                    <ProjectIcon
                      icon={collection.icon}
                      projectName={collection.name}
                    />
                  }
                  count={collectionRuns.length}
                  action={{
                    label: "New chat in project",
                    onClick: () => onNewChatInCollection(collection.id),
                  }}
                  // secondaryAction={{
                  //   label: "Project sources",
                  //   onClick: () => setSourcesCollection(collection),
                  //   icon: (
                  //     <Document className="size-3 text-primary-800 dark:text-primary-200" />
                  //   ),
                  // }}
                >
                  <div className="flex flex-col space-y-0.5">
                    {collectionRuns.length > 0 ? (
                      collectionRuns.map((run) => renderChat(run))
                    ) : (
                      <div className="px-2 py-1">
                        <Text as="span" size="xxs" tone="muted">
                          No chats
                        </Text>
                      </div>
                    )}
                  </div>
                </SidebarGroupSection>
              );
            })}
          </div>
        </div>
      )}
      {standaloneRuns.length > 0 && (
        <div>
          <div className="px-2 py-1">
            <Text as="span" size="xs" tone="secondary" weight="medium">
              Recents
            </Text>
          </div>
          <div className="flex flex-col space-y-0.5">
            {standaloneRuns
              .slice(0, RECENTS_LIMIT)
              .map((run) => renderChat(run, true))}
          </div>
        </div>
      )}
      {runs.length === 0 && (
        <div className="py-3 text-center">
          <Text as="span" size="xs" tone="muted">
            No chats yet
          </Text>
        </div>
      )}
      <CollectionSourcesModal
        key={sourcesCollection?.id ?? "closed"}
        accountId={account?.id ?? ""}
        collection={sourcesCollection}
        onClose={() => setSourcesCollection(null)}
      />
    </div>
  );
}
