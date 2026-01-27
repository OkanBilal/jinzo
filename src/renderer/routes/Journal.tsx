import { useParams } from "react-router-dom";
import { JournalEditor, EmptyJournalState } from "@/features/journal";

export default function JournalPage() {
  const { id } = useParams<{ id?: string }>();

  if (!id) {
    return <EmptyJournalState />;
  }

  // Use key to force remount when switching journals, ensuring fresh editor state
  return <JournalEditor key={id} entityId={id} />;
}
