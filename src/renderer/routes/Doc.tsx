import { useEffect, useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { Block } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import {
  useGetJournalByIdQuery,
  useSaveJournalMutation,
  usePublishJournalMutation,
  setEditingJournal,
  updateEditingTitle,
  updateEditingBody,
  clearEditingJournal,
} from "@/lib/redux/api";
import { useAppDispatch } from "@/lib/redux/hooks";
import { useJournalAutosave } from "@/hooks/useJournalAutosave";
import { SecondaryButton, SuccessButton } from "@/components/ui/button";

// Utility to convert BlockNote content to markdown-ish text
function blocksToMarkdown(blocks: Block[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    let line = "";
    const content = block.content;

    // Handle different block types
    if (block.type === "heading") {
      const level = (block.props as any)?.level || 1;
      line = "#".repeat(level) + " ";
    }

    // Extract text from content array
    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === "string") {
          line += item;
        } else if (item && typeof item === "object" && "text" in item) {
          line += (item as any).text || "";
        }
      }
    } else if (typeof content === "string") {
      line += content;
    }

    if (line.trim() || block.type === "paragraph") {
      lines.push(line);
    }

    // Recursively handle children
    if (block.children && block.children.length > 0) {
      lines.push(blocksToMarkdown(block.children));
    }
  }

  return lines.join("\n");
}

// Default props for block types
const defaultParagraphProps = {
  backgroundColor: "default" as const,
  textColor: "default" as const,
  textAlignment: "left" as const,
};

const defaultHeadingProps = {
  backgroundColor: "default" as const,
  textColor: "default" as const,
  textAlignment: "left" as const,
  level: 1 as 1 | 2 | 3,
};

// Parse markdown back to BlockNote blocks (simple version)
function markdownToBlocks(markdown: string): Block[] {
  if (!markdown) {
    return [
      {
        id: crypto.randomUUID(),
        type: "paragraph",
        props: { ...defaultParagraphProps },
        content: [],
        children: [],
      } as Block,
    ];
  }

  const lines = markdown.split("\n");
  const blocks: Block[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      const text = headingMatch[2];
      blocks.push({
        id: crypto.randomUUID(),
        type: "heading",
        props: { ...defaultHeadingProps, level },
        content: [{ type: "text", text, styles: {} }],
        children: [],
      } as Block);
    } else {
      blocks.push({
        id: crypto.randomUUID(),
        type: "paragraph",
        props: { ...defaultParagraphProps },
        content: line ? [{ type: "text", text: line, styles: {} }] : [],
        children: [],
      } as Block);
    }
  }

  return blocks.length > 0
    ? blocks
    : [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          props: { ...defaultParagraphProps },
          content: [],
          children: [],
        } as Block,
      ];
}

interface JournalEditorProps {
  entityId: string;
}

function JournalEditor({ entityId }: JournalEditorProps) {
  const dispatch = useAppDispatch();
  const { data: journal, isLoading } = useGetJournalByIdQuery(entityId);
  console.log("Loaded journal:", journal);
  const [saveJournal] =
    useSaveJournalMutation();
  const [publishJournal] =
    usePublishJournalMutation();

  const { queueSave, flush, isDirty, isSaving, lastSavedAt } =
    useJournalAutosave(entityId);

  // Track if we've initialized the editor with content from the server
  const [isEditorInitialized, setIsEditorInitialized] = useState(false);

  // Local title state for editing
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
      dispatch(setEditingJournal({
        entityId,
        title: journal.title || "Untitled",
        body: journal.body || "",
        status: journal.metadata?.status || "draft",
      }));
    }
  }, [journal, isEditorInitialized, editor, dispatch, entityId]);

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

  // Handle title change
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setLocalTitle(newTitle);
    queueSave({ title: newTitle });
    // Update Redux for chat context
    dispatch(updateEditingTitle(newTitle));
  }, [queueSave, dispatch]);

  // Handle title blur - flush immediately when user leaves the title field
  const handleTitleBlur = useCallback(() => {
    flush();
  }, [flush]);

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
          <input
            type="text"
            value={localTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            placeholder="Untitled"
            className="text-3xl font-semibold bg-transparent border-none outline-none text-primary-900 dark:text-primary-100 placeholder-primary-400 dark:placeholder-primary-500 w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-primary-400 dark:text-primary-500 opacity-60">
            {isSaving
              ? "Saving..."
              : isDirty
                ? "Unsaved changes"
                : lastSavedAt
                  ? `last saved ${lastSavedAt.toLocaleTimeString()}`
                  : ""}
          </span>
          <SecondaryButton
            className="px-5"
            onClick={handleSave}
            disabled={isShowingSaveLoading || isSaving}
          >
            {isShowingSaveLoading ? "Saving..." : "Save"}
          </SecondaryButton>
          {isDraft && (
            <SuccessButton
              onClick={handlePublish}
              disabled={isShowingPublishLoading || isSaving}
              className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isShowingPublishLoading ? "Publishing..." : "Publish"}
            </SuccessButton>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto py-8 ">
        <BlockNoteView
          editor={editor}
          onChange={handleEditorChange}
          data-theming-css-demo
        />
      </div>
    </div>
  );
}

// Empty state when no journal is selected
function EmptyJournalState() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center px-6">
      <div className="text-6xl mb-4">✍️</div>
      <h2 className="text-xl font-semibold text-primary-800 dark:text-primary-200 mb-2">
        Welcome to Journal
      </h2>
      <p className="text-primary-500 dark:text-primary-400 max-w-md">
        Select an existing post from the sidebar or create a new one to start
        writing.
      </p>
    </div>
  );
}

export default function DocPage() {
  const { id } = useParams<{ id?: string }>();

  if (!id) {
    return <EmptyJournalState />;
  }

  // Use key to force remount when switching journals, ensuring fresh editor state
  return <JournalEditor key={id} entityId={id} />;
}
