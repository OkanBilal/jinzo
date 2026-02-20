import { useReducer, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Close } from "@/components/ui/icons";
import { Heading3, Body, Muted } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
} from "@/lib/redux/api";
import type { StructuredOutputEntry } from "../../../../main/modules/providers/adapters/adapter.types";
import { SchemaListTab } from "./schema-list-tab";
import { SchemaEditorTab, type SchemaProperty } from "./schema-editor-tab";

function schemaToProperties(schema: Record<string, unknown>): SchemaProperty[] {
  const props = (schema.properties ?? {}) as Record<string, any>;
  const required = (schema.required ?? []) as string[];
  return Object.entries(props).map(([name, def]) => {
    let type: SchemaProperty["type"] = "string";
    let isArray = false;
    if (def?.type === "array") {
      isArray = true;
      type = (def.items?.type as SchemaProperty["type"]) ?? "string";
    } else if (def?.type) {
      type = def.type as SchemaProperty["type"];
    }
    return {
      id: crypto.randomUUID(),
      name,
      type,
      isArray,
      isRequired: required.includes(name),
    };
  });
}

function propertiesToSchema(
  properties: SchemaProperty[],
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of properties) {
    if (!p.name.trim()) continue;
    if (p.isArray) {
      props[p.name] = { type: "array", items: { type: p.type } };
    } else {
      props[p.name] = { type: p.type };
    }
    if (p.isRequired) required.push(p.name);
  }
  const schema: Record<string, unknown> = { type: "object", properties: props };
  if (required.length > 0) schema.required = required;
  return schema;
}

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
  const [updateProvider] = useUpdateProviderMutation();
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

  // ─── Persistence ───

  async function persistConfig(
    newEntries: Record<string, StructuredOutputEntry>,
    newSelectedId: string | null,
  ) {
    try {
      await updateProvider({
        id: providerId,
        payload: {
          config: {
            ...config,
            structuredOutputs: newEntries,
            structuredOutputsSelectedId: newSelectedId,
            ...(enableFlag && {
              structuredOutputEnabled: newSelectedId !== null,
            }),
          },
        },
      }).unwrap();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save structured output config");
    }
  }

  // ─── Editor helpers ───

  function openNewEditor() {
    updateState({
      editingId: null,
      editorName: "",
      editorProperties: [],
      activeTab: "editor",
    });
  }

  function openEditEditor(id: string) {
    const entry = entries[id];
    if (!entry) return;
    updateState({
      editingId: id,
      editorName: entry.name,
      editorProperties: schemaToProperties(entry.schema),
      activeTab: "editor",
    });
  }

  // ─── Property row handlers ───

  function handleAddProperty() {
    updateState({
      editorProperties: [
        ...editorProperties,
        {
          id: crypto.randomUUID(),
          name: "",
          type: "string",
          isArray: false,
          isRequired: false,
        },
      ],
    });
  }

  function handleUpdateProperty(
    index: number,
    updates: Partial<SchemaProperty>,
  ) {
    const updated = [...editorProperties];
    updated[index] = { ...updated[index], ...updates };
    updateState({ editorProperties: updated });
  }

  function handleRemoveProperty(index: number) {
    updateState({
      editorProperties: editorProperties.filter((_, i) => i !== index),
    });
  }

  // ─── Save ───

  async function handleSaveSchema() {
    if (!editorName.trim()) {
      toast.error("Name is required");
      return;
    }

    const hasEmptyName = editorProperties.some((p) => p.name.trim() === "");
    if (editorProperties.length > 0 && hasEmptyName) {
      toast.error("All properties must have a name");
      return;
    }

    updateState({ isSaving: true });
    try {
      const schema = propertiesToSchema(editorProperties);
      const now = Math.floor(Date.now() / 1000);

      let newEntries: Record<string, StructuredOutputEntry>;

      if (editingId && entries[editingId]) {
        newEntries = {
          ...entries,
          [editingId]: {
            ...entries[editingId],
            name: editorName.trim(),
            schema,
            updatedAt: now,
          },
        };
      } else {
        const id = crypto.randomUUID();
        newEntries = {
          ...entries,
          [id]: {
            id,
            name: editorName.trim(),
            schema,
            createdAt: now,
            updatedAt: now,
          },
        };
      }

      await persistConfig(newEntries, selectedId);
      toast.success(editingId ? "Schema updated" : "Schema created");
      updateState({
        activeTab: "schemas",
        editingId: null,
        editorName: "",
        editorProperties: [],
      });
    } finally {
      updateState({ isSaving: false });
    }
  }

  // ─── List handlers ───

  async function handleSelectSchema(id: string | null) {
    await persistConfig(entries, id);
  }

  async function handleDuplicateSchema(id: string) {
    const entry = entries[id];
    if (!entry) return;
    const newId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const newEntries = {
      ...entries,
      [newId]: {
        id: newId,
        name: `${entry.name} (copy)`,
        schema: { ...entry.schema },
        createdAt: now,
        updatedAt: now,
      },
    };
    await persistConfig(newEntries, selectedId);
    toast.success("Schema duplicated");
  }

  async function handleConfirmDelete() {
    if (!deleteTargetId) return;
    const { [deleteTargetId]: _, ...rest } = entries;
    const newSelectedId = selectedId === deleteTargetId ? null : selectedId;
    await persistConfig(rest, newSelectedId);
    if (editingId === deleteTargetId) {
      updateState({
        editingId: null,
        editorName: "",
        editorProperties: [],
        activeTab: "schemas",
        deleteTargetId: null,
      });
    } else {
      updateState({ deleteTargetId: null });
    }
    toast.success("Schema deleted");
  }

  async function handleRenameConfirm(id: string) {
    const trimmed = state.renameValue.trim();
    if (!trimmed || !entries[id]) {
      updateState({ renamingId: null });
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const newEntries = {
      ...entries,
      [id]: { ...entries[id], name: trimmed, updatedAt: now },
    };
    await persistConfig(newEntries, selectedId);
    updateState({ renamingId: null });
  }

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
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-primary-950/70"
        role="presentation"
        onClick={onClose}
      />
      <div
        className="relative z-40 w-full max-w-180 glass-morphism h-120 rounded-3xl animate-dropdown-in "
        role="dialog"
        aria-modal="true"
      >
        {/* Header + Tabs */}
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <Heading3>Structured outputs</Heading3>
            <div className="relative flex items-center rounded-xl bg-primary-950/4 dark:bg-primary/6 p-0.5">
              <div
                className="absolute top-0.5 h-[calc(100%-4px)] w-[calc(50%-2px)] rounded-[11px] bg-white dark:bg-primary-800 shadow-sm transition-transform duration-200 ease-out"
                style={{
                  transform:
                    activeTab === "schemas"
                      ? "translateX(0px)"
                      : "translateX(calc(100% + 0px))",
                }}
              />
              <Button
                onClick={() => updateState({ activeTab: "schemas" })}
                className={`relative z-10 px-3 py-1.5 rounded-xl text-sm transition-colors duration-200 cursor-pointer min-w-20 ${
                  activeTab === "schemas"
                    ? "text-primary-900 dark:text-primary-100"
                    : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                }`}
              >
                Schemas
              </Button>
              <Button
                onClick={() => updateState({ activeTab: "editor" })}
                className={`relative z-10 px-3 py-1.5 rounded-xl text-sm transition-colors duration-200 cursor-pointer min-w-20 ${
                  activeTab === "editor"
                    ? "text-primary-900 dark:text-primary-100"
                    : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                }`}
              >
                {editingId ? "Edit" : "New"}
              </Button>
            </div>
          </div>
          <Button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
          >
            <Close className="w-4 h-4" />
          </Button>
        </div>

        {activeTab === "schemas" && (
          <SchemaListTab
            sortedEntries={sortedEntries}
            selectedId={selectedId}
            renamingId={state.renamingId}
            renameValue={state.renameValue}
            onSelectSchema={handleSelectSchema}
            onOpenNewEditor={openNewEditor}
            onOpenEditEditor={openEditEditor}
            onDuplicate={handleDuplicateSchema}
            onRequestDelete={(id) => updateState({ deleteTargetId: id })}
            onRenameChange={(value) => updateState({ renameValue: value })}
            onRenameConfirm={handleRenameConfirm}
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
            onAddProperty={handleAddProperty}
            onUpdateProperty={handleUpdateProperty}
            onRemoveProperty={handleRemoveProperty}
            onReset={() => updateState({ editorProperties: [] })}
            onSave={handleSaveSchema}
          />
        )}

        {/* Delete confirmation */}
        {deleteTargetId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-3xl ">
            <div className="glass-morphism min-w-md rounded-3xl px-6 py-10 space-y-3 animate-dropdown-in ">
              <Body className="font-medium">Delete schema?</Body>
              <Muted className="text-sm mb-6">
                &ldquo;{entries[deleteTargetId]?.name}&rdquo; will be
                permanently removed.
              </Muted>
              <div className="flex justify-end gap-3 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updateState({ deleteTargetId: null })}
                >
                  Cancel
                </Button>
                <Button
                  variant="submit"
                  size="sm"
                  onClick={handleConfirmDelete}
                  className="bg-red-600! hover:bg-red-700! text-white!"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
