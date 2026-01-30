import { useEffect, useCallback, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import {
  useGetJournalByIdQuery,
  useSaveJournalMutation,
  usePublishJournalMutation,
  setEditingJournal,
  updateEditingBody,
  handleTitleUpdate,
  clearEditingJournal,
} from "@/lib/redux/api";
import { useAppDispatch } from "@/lib/redux/hooks";
import { useJournalAutosave } from "@/features/journal/hooks/use-journal-auto-save";
import { Button } from "@/components/ui/button";
import { AnimatedTitle } from "@/components/ui/animated-title";
import { blocksToMarkdown, markdownToBlocks } from "../utils";

interface JournalEditorProps {
  entityId: string;
}

export function JournalEditor({ entityId }: JournalEditorProps) {
  const dispatch = useAppDispatch();
  const { data: journal, isLoading } = useGetJournalByIdQuery(entityId);
  const [saveJournal] = useSaveJournalMutation();
  const [publishJournal] = usePublishJournalMutation();

  const { queueSave, flush, isDirty, isSaving, lastSavedAt } =
    useJournalAutosave(entityId);

  // Track if we've initialized the editor with content from the server
  const [isEditorInitialized, setIsEditorInitialized] = useState(false);

  // Local title state for display
  const [localTitle, setLocalTitle] = useState("");

  // Local loading states with minimum duration to prevent flicker
  const [isShowingSaveLoading, setIsShowingSaveLoading] = useState(false);
  const [isShowingPublishLoading, setIsShowingPublishLoading] = useState(false);

  // Create BlockNote editor with empty initial content
  // Content will be loaded after journal data is fetched
  const editor = useCreateBlockNote({
    initialContent: markdownToBlocks(""),
  });

  // Update editor content and title when journal loads (only once after data arrives)
  useEffect(() => {
    if (journal && !isEditorInitialized && editor) {
      const blocks = markdownToBlocks(journal.body || "");
      editor.replaceBlocks(editor.document, blocks);
      setLocalTitle(journal.title || "Untitled");
      setIsEditorInitialized(true);

      // Dispatch to Redux for chat context
      dispatch(
        setEditingJournal({
          entityId,
          title: journal.title || "Untitled",
          body: journal.body || "",
          status: journal.metadata?.status || "draft",
        }),
      );
    }
  }, [journal, isEditorInitialized, editor, dispatch, entityId]);

  // Sync title when journal data changes (e.g., from sidebar rename)
  useEffect(() => {
    if (journal && isEditorInitialized) {
      const newTitle = journal.title || "Untitled";
      if (newTitle !== localTitle) {
        setLocalTitle(newTitle);
        dispatch(handleTitleUpdate({ entityId, title: newTitle }));
      }
    }
  }, [journal?.title]);

  // Register this journal as currently editing (for MCP tools)
  useEffect(() => {
    window.api.journal.setEditing(entityId);
    return () => {
      window.api.journal.setEditing(null);
    };
  }, [entityId]);

  // Clear editing state on unmount
  useEffect(() => {
    return () => {
      dispatch(clearEditingJournal());
    };
  }, [dispatch]);

  // Listen for content updates from MCP tools (when AI appends text)
  useEffect(() => {
    const unsubscribe = window.api.journal.onContentUpdated((data) => {
      if (data.entityId === entityId && editor) {
        // Update the editor with new content
        const blocks = markdownToBlocks(data.body);
        editor.replaceBlocks(editor.document, blocks);

        // Update Redux state
        dispatch(updateEditingBody(data.body));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [entityId, editor, dispatch]);

  // Listen for title updates from MCP tools (when AI suggests/changes title)
  useEffect(() => {
    const unsubscribe = window.api.journal.onTitleUpdated((data) => {
      if (data.entityId === entityId) {
        // Update local title state
        setLocalTitle(data.title);

        // Update Redux state
        dispatch(handleTitleUpdate(data));

        // Queue save to persist the title change
        queueSave({ title: data.title });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [entityId, dispatch, queueSave]);

  // Handle editor changes
  const handleEditorChange = useCallback(() => {
    if (!editor) return;

    const blocks = editor.document;
    const body = blocksToMarkdown(blocks);

    queueSave({ body });
    // Update Redux for chat context
    dispatch(updateEditingBody(body));
  }, [editor, queueSave, dispatch]);

  // Handle explicit save with minimum loading time to avoid flicker
  const handleSave = useCallback(async () => {
    setIsShowingSaveLoading(true);
    const startTime = Date.now();

    try {
      await flush();
      await saveJournal(entityId);
    } finally {
      // Ensure loading state shows for at least 500ms to avoid glitch
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 500 - elapsed);

      setTimeout(() => {
        setIsShowingSaveLoading(false);
      }, remainingTime);
    }
  }, [flush, saveJournal, entityId]);

  // Handle publish with minimum loading time to avoid flicker
  const handlePublish = useCallback(async () => {
    setIsShowingPublishLoading(true);
    const startTime = Date.now();

    try {
      await flush();
      await publishJournal(entityId);
    } finally {
      // Ensure loading state shows for at least 500ms to avoid glitch
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 500 - elapsed);

      setTimeout(() => {
        setIsShowingPublishLoading(false);
      }, remainingTime);
    }
  }, [flush, publishJournal, entityId]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-primary-500 dark:text-primary-400">
          Loading...
        </span>
      </div>
    );
  }

  const isDraft = journal?.metadata?.status === "draft";

  return (
    <div className=" h-full flex flex-col py-12 max-w-4xl mx-auto">
      {/* Header with save status and actions */}
      <div className="flex items-center justify-between px-13.5 py-8  ">
        <div className="flex items-center gap-3 flex-1">
          <AnimatedTitle
            title={localTitle || "Untitled"}
            className="text-3xl font-semibold text-primary-900 dark:text-primary-100 w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-primary-400 dark:text-primary-300 opacity-80">
            {isSaving
              ? "Saving..."
              : isDirty
                ? "Unsaved changes"
                : lastSavedAt
                  ? `last saved ${lastSavedAt.toLocaleTimeString()}`
                  : ""}
          </span>
          <Button
            variant="primary"
            tooltip="Save post"
            className="px-3"
            onClick={handleSave}
            disabled={isShowingSaveLoading || isSaving}
          >
            {isShowingSaveLoading ? "Saving..." : "Save"}
          </Button>
          {isDraft && (
            <Button
              tooltip="Publish post"
              variant="submit"
              onClick={handlePublish}
              disabled={isShowingPublishLoading || isSaving}
              className=""
            >
              {isShowingPublishLoading ? "Publishing..." : "Publish"}
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto py-8">
        <BlockNoteView
          editor={editor}
          onChange={handleEditorChange}
          data-theming-css-demo
        />
      </div>
    </div>
  );
}
