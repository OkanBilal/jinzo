import { useState, useSyncExternalStore, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Close,
  Trash,
  Edit,
  Asterisk,
  Duplicate,
} from "@/components/ui/icons";
import { Heading3, Body, Muted } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import Select from "@/components/ui/select";
import {
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
} from "@/lib/redux/api";
import type { StructuredOutputEntry } from "../../../../main/modules/providers/adapters/adapter.types";

interface SchemaProperty {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  isArray: boolean;
  isRequired: boolean;
}

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
    return { name, type, isArray, isRequired: required.includes(name) };
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

interface StructuredOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptySubscribe = () => () => {};

export function StructuredOutputModal({
  isOpen,
  onClose,
}: StructuredOutputModalProps) {
  const isBrowser = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const { data: provider } = useGetProviderByIdQuery("ollama");
  const [updateProvider] = useUpdateProviderMutation();
  const config = (provider?.config ?? {}) as Record<string, unknown>;

  const entries = (config.structuredOutputs ?? {}) as Record<
    string,
    StructuredOutputEntry
  >;
  const selectedId =
    (config.structuredOutputsSelectedId as string | null) ?? null;

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("schemas");

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorProperties, setEditorProperties] = useState<SchemaProperty[]>(
    [],
  );
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Reset state when modal opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (isOpen && !prevOpen) {
    setActiveTab("schemas");
    setEditingId(null);
    setEditorName("");
    setEditorProperties([]);
    setDeleteTargetId(null);
    setRenamingId(null);
  }
  if (isOpen !== prevOpen) setPrevOpen(isOpen);

  // ─── Persistence ───

  async function persistConfig(
    newEntries: Record<string, StructuredOutputEntry>,
    newSelectedId: string | null,
  ) {
    try {
      await updateProvider({
        id: "ollama",
        payload: {
          config: {
            ...config,
            structuredOutputs: newEntries,
            structuredOutputsSelectedId: newSelectedId,
            structuredOutputEnabled: newSelectedId !== null,
          },
        },
      }).unwrap();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save structured output config");
    }
  }

  // ─── Editor helpers ───

  function openNewEditor() {
    setEditingId(null);
    setEditorName("");
    setEditorProperties([]);
    setActiveTab("editor");
  }

  function openEditEditor(id: string) {
    const entry = entries[id];
    if (!entry) return;
    setEditingId(id);
    setEditorName(entry.name);
    setEditorProperties(schemaToProperties(entry.schema));
    setActiveTab("editor");
  }

  // ─── Property row handlers ───

  function handleAddProperty() {
    setEditorProperties([
      ...editorProperties,
      { name: "", type: "string", isArray: false, isRequired: false },
    ]);
  }

  function handleUpdateProperty(
    index: number,
    updates: Partial<SchemaProperty>,
  ) {
    const updated = [...editorProperties];
    updated[index] = { ...updated[index], ...updates };
    setEditorProperties(updated);
  }

  function handleRemoveProperty(index: number) {
    setEditorProperties(editorProperties.filter((_, i) => i !== index));
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

    setIsSaving(true);
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
      setActiveTab("schemas");
      setEditingId(null);
      setEditorName("");
      setEditorProperties([]);
    } finally {
      setIsSaving(false);
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
      setEditingId(null);
      setEditorName("");
      setEditorProperties([]);
      setActiveTab("schemas");
    }
    setDeleteTargetId(null);
    toast.success("Schema deleted");
  }

  async function handleRenameConfirm(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed || !entries[id]) {
      setRenamingId(null);
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const newEntries = {
      ...entries,
      [id]: { ...entries[id], name: trimmed, updatedAt: now },
    };
    await persistConfig(newEntries, selectedId);
    setRenamingId(null);
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
      <div className="absolute inset-0 bg-primary-950/70" onClick={onClose} />
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
              {/* Sliding background indicator */}
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
                onClick={() => setActiveTab("schemas")}
                className={`relative z-10 px-3 py-1.5 rounded-xl text-sm transition-colors duration-200 cursor-pointer min-w-20 ${
                  activeTab === "schemas"
                    ? "text-primary-900 dark:text-primary-100"
                    : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                }`}
              >
                Schemas
              </Button>
              <Button
                onClick={() => setActiveTab("editor")}
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

        {/* ─── Schemas Tab ─── */}
        {activeTab === "schemas" && (
          <>
            <div className="p-4 pt-0">
              <div className="h-78 overflow-y-auto space-y-1">
                {/* "Do not use" row */}
                <button
                  onClick={() => handleSelectSchema(null)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors cursor-pointer ${
                    selectedId === null
                      ? "bg-primary-950/8 dark:bg-primary/12 text-primary-900 dark:text-primary-100"
                      : "text-primary-600 dark:text-primary-400 hover:bg-primary-950/4 dark:hover:bg-primary/6"
                  }`}
                >
                  <RadioDot active={selectedId === null} />
                  <span>Do not use structured output</span>
                </button>

                {/* Schema entries */}
                {sortedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`group flex items-center h-10 gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      selectedId === entry.id
                        ? "bg-primary-950/8 dark:bg-primary/12 text-primary-900 dark:text-primary-100"
                        : "text-primary-600 dark:text-primary-400 hover:bg-primary-950/4 dark:hover:bg-primary/6"
                    }`}
                  >
                    <button
                      onClick={() => handleSelectSchema(entry.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                    >
                      <RadioDot active={selectedId === entry.id} />
                      {renamingId === entry.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleRenameConfirm(entry.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={() => handleRenameConfirm(entry.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-transparent border-b border-primary-400 dark:border-primary-600 outline-none text-sm"
                        />
                      ) : (
                        <span className="truncate">{entry.name}</span>
                      )}
                    </button>

                    {/* Action buttons */}
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <Button
                        tooltip="Edit Schema"
                        onClick={() => openEditEditor(entry.id)}
                        className="p-1 rounded hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit className="size-4" />
                      </Button>
                      <Button
                        tooltip="Duplicate Schema"
                        onClick={() => handleDuplicateSchema(entry.id)}
                        className="p-1 rounded hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors cursor-pointer"
                        title="Duplicate"
                      >
                        <Duplicate className="size-4" />
                      </Button>
                      <button
                        onClick={() => setDeleteTargetId(entry.id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {sortedEntries.length === 0 && (
                  <Muted className="text-xs px-3 py-4 text-center">
                    No schemas yet. Create one using the editor tab.
                  </Muted>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-primary-950/5 dark:border-primary/10">
              <Button variant="primary" size="sm" onClick={openNewEditor}>
                New schema
              </Button>
            </div>
          </>
        )}

        {/* ─── Editor Tab ─── */}
        {activeTab === "editor" && (
          <>
            <div className="p-4 pt-0">
              <div className="h-78 overflow-y-auto overflow-x-visible">
                <Body className="mt-2 mb-2">Name</Body>
                <Input
                  type="text"
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  placeholder="Schema name"
                  className="w-full p-2 mb-2 dark:bg-primary! shadow-none! dark:placeholder:text-primary-800! dark:text-primary-900 "
                />
                <div className="space-y-3 flex-col">
                  <Body className="mt-1 mb-2">Property</Body>
                  {editorProperties.map((prop, index) => (
                    <PropertyRow
                      key={index}
                      property={prop}
                      onUpdate={(updates) =>
                        handleUpdateProperty(index, updates)
                      }
                      onRemove={() => handleRemoveProperty(index)}
                    />
                  ))}
                  <div className="px-2 -ml-2">
                    <Button
                      onClick={handleAddProperty}
                      variant="primary"
                      size="sm"
                    >
                      + Add property
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-primary-950/5 dark:border-primary/10">
              <Button
                onClick={() => {
                  setEditorProperties([]);
                }}
                variant="ghost"
              >
                Reset
              </Button>
              <Button
                onClick={handleSaveSchema}
                disabled={!canSave}
                isLoading={isSaving}
                variant="submit"
                size="sm"
              >
                {editingId ? "Update" : "Save"}
              </Button>
            </div>
          </>
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
                  onClick={() => setDeleteTargetId(null)}
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

// ─── Sub-components ───

function RadioDot({ active }: { active: boolean }) {
  return (
    <span
      className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
        active
          ? "border-primary-900 dark:border-primary-300 bg-primary-900 dark:bg-primary-600"
          : "border-primary-400 dark:border-primary-600"
      }`}
    />
  );
}

interface PropertyRowProps {
  property: SchemaProperty;
  onUpdate: (updates: Partial<SchemaProperty>) => void;
  onRemove: () => void;
}

const typeOptions: { value: string; label: string }[] = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
  { value: "array", label: "array" },
  { value: "object", label: "object" },
];

function PropertyRow({ property, onUpdate, onRemove }: PropertyRowProps) {
  const isNameEmpty = property.name.trim() === "";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <Input
          type="text"
          value={property.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Property name"
          hasError={isNameEmpty}
          className="py-2.5 dark:bg-primary! shadow-none! dark:placeholder:text-primary-800! dark:text-primary-900"
        />
      </div>
      <div className="w-52 shrink-0">
        <Select
          useFixedBackground={true}
          value={property.type}
          options={typeOptions}
          onChange={(val) => onUpdate({ type: val as SchemaProperty["type"] })}
          placeholder="Type"
        />
      </div>
      <Button
        onClick={() => onUpdate({ isArray: !property.isArray })}
        className={`shrink-0 px-2.5 py-2 border border-primary-950/10 dark:border-primary/10 rounded-xl text-sm transition-all  ${
          property.isArray
            ? "bg-primary-950/8 dark:bg-primary/20 text-primary-800 dark:text-primary-200"
            : "bg-primary-950/3 dark:bg-primary/5 text-primary-500 dark:text-primary-400"
        }`}
        title="Is Array"
      >
        [ ]
      </Button>
      <Button
        onClick={() => onUpdate({ isRequired: !property.isRequired })}
        className={`shrink-0 py-2.5 px-2 border border-primary-950/10 dark:border-primary/10 rounded-xl text-sm transition-all ${
          property.isRequired
            ? "bg-primary-950/8 dark:bg-primary/20 text-primary-800 dark:text-primary-200"
            : "bg-primary-950/3 dark:bg-primary/5 text-primary-500 dark:text-primary-400"
        }`}
        title="Required"
      >
        <Asterisk className="w-4 h-4" />
      </Button>
      <Button
        onClick={onRemove}
        className="shrink-0 p-2 text-primary-500 cursor-pointer hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
        title="Remove"
      >
        <Trash className="w-4 h-4" />
      </Button>
    </div>
  );
}
