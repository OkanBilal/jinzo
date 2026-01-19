import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

export default function DocPage() {
  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: "heading",
        content: "New Post",
      },
      {
        type: "paragraph",
        content: "Welcome to Journal Mood ✍️",
      },
      {
        type: "paragraph",
        content: "Start writing your thoughts here...",
      },
    ],
  });

  return (
    <div className="w-full py-12 px-6">
      <BlockNoteView editor={editor} data-theming-css-demo />
    </div>
  );
}
