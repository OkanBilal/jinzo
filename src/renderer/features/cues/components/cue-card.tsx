import { Button, toast } from "@/components/ui";
import { Check, Clipboard, Delete, Note, Sparkles } from "@/components/ui/icons";
import { useDeleteCueMutation, useUpdateCueMutation, type Cue } from "@/lib/redux/api/cuesApi";

interface CueCardProps {
  cue: Cue;
}

const KIND_LABEL = { note: "Note", prompt: "Prompt", todo: "To-do" } as const;

export function CueCard({ cue }: CueCardProps) {
  const [updateCue] = useUpdateCueMutation();
  const [deleteCue] = useDeleteCueMutation();

  const update = (input: Parameters<typeof updateCue>[0]["input"]) =>
    updateCue({ id: cue.id, projectId: cue.projectId, input });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cue.content);
      toast.success("Cue copied");
    } catch {
      toast.error("Could not copy Cue");
    }
  };

  const remove = async () => {
    try {
      await deleteCue({ id: cue.id, projectId: cue.projectId }).unwrap();
      toast.success("Cue removed");
    } catch {
      toast.error("Cue could not be removed");
    }
  };

  const icon = cue.kind === "prompt" ? Sparkles : Note;
  const CueIcon = icon;

  return (
    <article className={`group relative rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
      cue.isPinned
        ? "border-primary-400/70 bg-primary-100/70 dark:border-primary/25 dark:bg-primary-900/70"
        : "border-primary-200/90 bg-primary-50/80 dark:border-primary/10 dark:bg-primary-900/45"
    }`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary-200/75 dark:bg-primary/10">
            <CueIcon className="size-3.5 text-primary-700 dark:text-primary-200" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-600 dark:text-primary-400">
            {KIND_LABEL[cue.kind]}
          </span>
        </div>
        <button
          type="button"
          onClick={() => update({ isPinned: !cue.isPinned })}
          className={`size-5 rounded-full border transition-colors ${cue.isPinned ? "border-primary-700 bg-primary-700 dark:border-primary-200 dark:bg-primary-200" : "border-primary-300/80 hover:border-primary-600 dark:border-primary/25"}`}
          aria-label={cue.isPinned ? "Unpin Cue" : "Pin Cue"}
        />
      </div>

      {cue.title && <h3 className="mb-1.5 text-sm font-semibold text-primary-950 dark:text-primary-50">{cue.title}</h3>}
      <p className="whitespace-pre-wrap text-sm leading-5 text-primary-750 dark:text-primary-200 line-clamp-6">
        {cue.content}
      </p>

      <footer className="mt-4 flex items-center justify-between border-t border-primary-200/70 pt-3 dark:border-primary/10">
        <span className="text-[11px] text-primary-500 dark:text-primary-500">
          {new Date(cue.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
        <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
          <Button variant="icon" className="size-7" tooltip="Copy Cue" onClick={copy}>
            <Clipboard className="size-3.5" />
          </Button>
          <Button
            variant="icon"
            className="size-7"
            tooltip={cue.status === "done" ? "Reopen Cue" : "Mark done"}
            onClick={() => update({ status: cue.status === "done" ? "inbox" : "done" })}
          >
            <Check className="size-3.5" />
          </Button>
          <Button variant="icon" className="size-7 hover:text-red-500" tooltip="Delete Cue" onClick={remove}>
            <Delete className="size-3.5" />
          </Button>
        </div>
      </footer>
    </article>
  );
}
