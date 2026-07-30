import { useState } from "react";
import { m } from "motion/react";
import { Button, CopyButton, toast } from "@/components/ui";
import { ArchiveCheck, Cue as IconCue, Pin, PinOutline, Sparkles, Trash } from "@/components/ui/icons";
import DeleteConfirmationModal from "@/components/layout/sidebar/delete-confirmation-modal";
import { useDeleteCueMutation, useUpdateCueMutation, type Cue } from "@/lib/redux/api/cuesApi";

interface CueCardProps {
  cue: Cue;
}

const KIND_LABEL = { note: "Note", prompt: "Prompt", todo: "To-do" } as const;

export function CueCard({ cue }: CueCardProps) {
  const [updateCue] = useUpdateCueMutation();
  const [deleteCue, { isLoading: isDeleting }] = useDeleteCueMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const update = (input: Parameters<typeof updateCue>[0]["input"]) =>
    updateCue({ id: cue.id, projectId: cue.projectId, input });

  const togglePin = async () => {
    try {
      await update({ isPinned: !cue.isPinned }).unwrap();
    } catch {
      toast.error("Cue could not be updated");
    }
  };

  const toggleDone = async () => {
    const isReopening = cue.status === "done";
    try {
      await update({ status: isReopening ? "inbox" : "done" }).unwrap();
      toast.success(isReopening ? "Cue moved back to Inbox" : "Cue marked done");
    } catch {
      toast.error("Cue could not be updated");
    }
  };

  const remove = async () => {
    try {
      await deleteCue({ id: cue.id, projectId: cue.projectId }).unwrap();
      toast.success("Cue removed");
      setDeleteOpen(false);
    } catch {
      toast.error("Cue could not be removed");
    }
  };

  const icon = cue.kind === "prompt" ? Sparkles : IconCue;
  const CueIcon = icon;

  return (
    <>
      <m.article
        layout="position"
        transition={{ layout: { duration: 0.34, ease: [0.22, 1, 0.36, 1] } }}
        className="group relative flex w-96 min-h-20 shrink-0 flex-col rounded-2xl px-4 py-3 glass-surface"
      >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
            <CueIcon className="size-4 text-primary-700 dark:text-primary-300" />
          <span className="text-xxs font-semibold uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
            {KIND_LABEL[cue.kind]}
          </span>
        </div>
        <Button
          variant="bare"
          onClick={() => void togglePin()}
          className={`grid size-7 place-items-center rounded-full transition-colors glass-outline ${cue.isPinned ? "text-primary-950 dark:text-primary-50" : "text-primary-500 dark:text-primary-400/50"}`}
          aria-label={cue.isPinned ? "Unpin Cue" : "Pin Cue"}
        >
          {cue.isPinned ? (
            <Pin className="size-3.5" />
          ) : (
            <PinOutline className="size-3.5" />
          )}
        </Button>
      </div>

      {cue.title && <h3 className="mb-1.5 text-sm font-semibold text-primary-950 dark:text-primary-50">{cue.title}</h3>}
      <p className="whitespace-pre-wrap text-sm leading-5 text-primary-750 dark:text-primary-200 line-clamp-6">
        {cue.content}
      </p>

      <footer className="mt-auto flex items-center justify-between pt-4">
        <span className="text-[11px] text-primary-500 dark:text-primary-500">
          {new Date(cue.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
        <div className="flex items-center gap-2">
          <CopyButton
            text={cue.content}
            tooltip="Copy Cue"
            copiedTooltip="Cue copied"
            className="flex size-5.6 items-center justify-center text-primary-600 hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-900"
          />
          <Button
            className="flex size-6 items-center justify-center text-primary-600 hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-900"
            tooltip={cue.status === "done" ? "Reopen Cue" : "Mark done"}
            onClick={() => void toggleDone()}

          >
            <ArchiveCheck className="size-4" />
          </Button>
          <Button
            className="flex size-6 items-center justify-center text-primary-600 hover:bg-primary-100 hover:text-red-500 dark:text-primary-300 dark:hover:bg-primary-900"
            tooltip="Delete Cue"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash className="size-4" />
          </Button>
        </div>
      </footer>
      </m.article>
      <DeleteConfirmationModal
        isOpen={deleteOpen}
        isDeleting={isDeleting}
        onConfirm={() => void remove()}
        onCancel={() => setDeleteOpen(false)}
        title="Delete Cue?"
        description="This Cue will be permanently removed from the project."
      />
    </>
  );
}
