import { useState } from "react";
import { Button, Input, Modal, ModalHeader, Textarea, toast } from "@/components/ui";
import { Note } from "@/components/ui/icons";
import {
  useCreateCueMutation,
  type CueKind,
  type CueStatus,
} from "@/lib/redux/api/cuesApi";

interface CueComposerProps {
  accountId: string | undefined;
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function CueComposer({ accountId, projectId, open, onClose }: CueComposerProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<CueKind>("note");
  const [status, setStatus] = useState<CueStatus>("inbox");
  const [createCue, { isLoading }] = useCreateCueMutation();

  const reset = () => {
    setTitle("");
    setContent("");
    setKind("note");
    setStatus("inbox");
  };

  const close = () => {
    if (isLoading) return;
    reset();
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountId || !content.trim()) return;

    try {
      await createCue({
        accountId,
        input: {
          projectId,
          title: title.trim() || null,
          content,
          kind,
          status,
        },
      }).unwrap();
      toast.success("Cue captured");
      reset();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cue could not be saved");
    }
  };

  return (
    <Modal isOpen={open} onClose={close} className="w-full max-w-xl">
      <ModalHeader onClose={close}>
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-primary-200/70 dark:bg-primary/10">
            <Note className="size-4 text-primary-800 dark:text-primary-100" />
          </span>
          <span className="text-sm font-semibold text-primary-950 dark:text-primary-50">
            Capture a Cue
          </span>
        </div>
      </ModalHeader>

      <form onSubmit={submit} className="p-5">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="grid gap-1.5 text-xs font-medium text-primary-700 dark:text-primary-300">
            Shape
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as CueKind)}
              className="h-9 rounded-xl border border-primary-300/70 bg-primary-50 px-3 text-sm text-primary-950 outline-none focus:ring-2 focus:ring-primary-500 dark:border-primary/15 dark:bg-primary-900 dark:text-primary-50"
            >
              <option value="note">Note</option>
              <option value="prompt">Prompt</option>
              <option value="todo">To-do</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-primary-700 dark:text-primary-300">
            Place
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as CueStatus)}
              className="h-9 rounded-xl border border-primary-300/70 bg-primary-50 px-3 text-sm text-primary-950 outline-none focus:ring-2 focus:ring-primary-500 dark:border-primary/15 dark:bg-primary-900 dark:text-primary-50"
            >
              <option value="inbox">Inbox</option>
              <option value="active">In progress</option>
              <option value="done">Done</option>
            </select>
          </label>
        </div>

        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="A short title (optional)"
          className="mb-3"
          autoFocus
        />
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="What do you want to keep close?"
          className="min-h-36 resize-y"
          required
        />
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-primary-600 dark:text-primary-400">
            Saved to this project, not a worktree.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit" variant="submit" isLoading={isLoading} disabled={!content.trim()}>
              Capture Cue
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
