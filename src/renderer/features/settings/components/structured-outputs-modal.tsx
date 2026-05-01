import { useReducer, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  useGetProviderByIdQuery,
} from "@/lib/redux/api";
import { SchemaListTab } from "./schema-list-tab";
import { SchemaEditorTab, type SchemaProperty } from "./schema-editor-tab";
import { SchemaDeleteDialog } from "./schema-delete-dialog";
import { SchemaModalHeader } from "./schema-modal-header";
import { useSchemaCrud } from "./use-schema-crud";
import { StructuredOutputEntry } from "../../../../main/modules/providers/adapters/adapter.types";

type Tab = "schemas" | "editor";

interface ModalState {
  activeTab: Tab;
  editingId: string | null;
  editorName: string;
  editorProperties: SchemaProperty[];
  isSaving: boolean;
  deleteTargetId: string | null;
  renamingId: string | null;
  renameValue: string;
  prevOpen: boolean;
}

const mergeState = (
  prev: ModalState,
  next: Partial<ModalState>,
): ModalState => ({
  ...prev,
  ...next,
});

interface StructuredOutputsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
  enableFlag?: boolean;
}

const emptySubscribe = () => () => {};

export function StructuredOutputsModal({
  isOpen,
  onClose,
  providerId,
  enableFlag = false,
}: StructuredOutputsModalProps) {
  const isBrowser = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const { data: provider } = useGetProviderByIdQuery(providerId);
  const config = (provider?.config ?? {}) as Record<string, unknown>;

  const entries = (config.structuredOutputs ?? {}) as Record<
    string,
    StructuredOutputEntry
  >;
  const selectedId =
    (config.structuredOutputsSelectedId as string | null) ?? null;

  const [state, updateState] = useReducer(mergeState, {
    activeTab: "schemas" as Tab,
    editingId: null,
    editorName: "",
    editorProperties: [] as SchemaProperty[],
    isSaving: false,
    deleteTargetId: null,
    renamingId: null,
    renameValue: "",
    prevOpen: false,
  });
  const {
    activeTab,
    editingId,
    editorName,
    editorProperties,
    isSaving,
    deleteTargetId,
  } = state;

  // Reset state when modal opens
  if (isOpen && !state.prevOpen) {
    updateState({
      activeTab: "schemas",
      editingId: null,
      editorName: "",
      editorProperties: [],
      deleteTargetId: null,
      renamingId: null,
    });
  }
  if (isOpen !== state.prevOpen) updateState({ prevOpen: isOpen });

  const crud = useSchemaCrud({
    providerId,
    config,
    entries,
    selectedId,
    enableFlag,
    editingId,
    editorName,
    editorProperties,
    renameValue: state.renameValue,
    deleteTargetId,
    updateState,
  });

  // ─── Render ───

  if (!isBrowser || !isOpen) return null;

  const sortedEntries = Object.values(entries).sort(
    (a, b) => a.createdAt - b.createdAt,
  );

  const hasEmptyPropertyName = editorProperties.some(
    (p) => p.name.trim() === "",
  );
  const canSave =
    editorName.trim() !== "" &&
    (editorProperties.length === 0 || !hasEmptyPropertyName);

  return createPortal(
    <div className="fixed inset-0 z-(--z-dropdown) flex items-center justify-center">
      <div
        className="absolute inset-0 bg-primary-950/70"
        role="presentation"
        onClick={onClose}
      />
      <div
        className="relative z-(--z-panel) w-full max-w-180 glass-morphism h-120 rounded-3xl animate-dropdown-in "
        role="dialog"
        aria-modal="true"
      >
        <SchemaModalHeader
          activeTab={activeTab}
          editingId={editingId}
          onTabChange={(tab) => updateState({ activeTab: tab })}
          onClose={onClose}
        />

        {activeTab === "schemas" && (
          <SchemaListTab
            sortedEntries={sortedEntries}
            selectedId={selectedId}
            renamingId={state.renamingId}
            renameValue={state.renameValue}
            onSelectSchema={crud.handleSelectSchema}
            onOpenNewEditor={crud.openNewEditor}
            onOpenEditEditor={crud.openEditEditor}
            onDuplicate={crud.handleDuplicateSchema}
            onRequestDelete={(id) => updateState({ deleteTargetId: id })}
            onRenameChange={(value) => updateState({ renameValue: value })}
            onRenameConfirm={crud.handleRenameConfirm}
            onRenameCancel={() => updateState({ renamingId: null })}
          />
        )}

        {activeTab === "editor" && (
          <SchemaEditorTab
            editorName={editorName}
            editorProperties={editorProperties}
            editingId={editingId}
            isSaving={isSaving}
            canSave={canSave}
            onNameChange={(name) => updateState({ editorName: name })}
            onAddProperty={crud.handleAddProperty}
            onUpdateProperty={crud.handleUpdateProperty}
            onRemoveProperty={crud.handleRemoveProperty}
            onReset={() => updateState({ editorProperties: [] })}
            onSave={crud.handleSaveSchema}
          />
        )}

        {deleteTargetId && (
          <SchemaDeleteDialog
            schemaName={entries[deleteTargetId]?.name ?? ""}
            onCancel={() => updateState({ deleteTargetId: null })}
            onConfirm={crud.handleConfirmDelete}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
