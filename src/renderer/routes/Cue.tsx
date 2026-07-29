import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Heading3, Muted } from "@/components/ui";
import { Inbox, Note, Plus, Project, Sparkles } from "@/components/ui/icons";
import { PageShell } from "@/components/layout/page-shell";
import { useGetAccountQuery } from "@/lib/redux/api/accountApi";
import { useListProjectsQuery } from "@/lib/redux/api/projectsApi";
import { useListCuesByProjectQuery, type Cue, type CueStatus } from "@/lib/redux/api/cuesApi";
import { CueCard } from "@/features/cues/components/cue-card";
import { CueComposer } from "@/features/cues/components/cue-composer";

const LANES: Array<{ status: CueStatus; label: string; note: string; icon: typeof Inbox }> = [
  { status: "inbox", label: "Inbox", note: "Keep it close", icon: Inbox },
  { status: "active", label: "In motion", note: "What you are using", icon: Sparkles },
  { status: "done", label: "Cleared", note: "Saved for later", icon: Note },
];

export default function CuePage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: account } = useGetAccountQuery();
  const { data: projects = [] } = useListProjectsQuery();
  const activeProjects = projects.filter((project) => !project.isArchived);
  const project = activeProjects.find((item) => item.id === projectId) ?? activeProjects[0];
  const { data: cues = [], isLoading } = useListCuesByProjectQuery(project?.id ?? "", {
    skip: !project,
  });
  const [composerOpen, setComposerOpen] = useState(false);

  const byStatus = (status: CueStatus): Cue[] => cues.filter((cue) => cue.status === status);

  if (!project && !isLoading) {
    return (
      <PageShell bottomPadded className="grid place-items-center">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-primary-100 dark:bg-primary-900">
            <Project className="size-6 text-primary-700 dark:text-primary-200" />
          </span>
          <Heading3>Cue needs a project</Heading3>
          <Muted className="mt-2">Create or restore a project first. Cues deliberately outlive individual workspaces.</Muted>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell bottomPadded className="cue-workbench">
      <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400">
            <span className="size-1.5 rounded-full bg-primary-700 dark:bg-primary-200" />
            Project memory
          </div>
          <Heading3>Cue</Heading3>
          <Muted className="mt-1 max-w-xl">A durable shelf for prompts, loose ends, and useful fragments — tied to a project, never a disposable worktree.</Muted>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={project?.id ?? ""}
            onChange={(event) => navigate(`/cue/${event.target.value}`)}
            className="h-9 max-w-52 rounded-xl border border-primary-300/80 bg-primary-50 px-3 text-sm font-medium text-primary-900 outline-none focus:ring-2 focus:ring-primary-500 dark:border-primary/15 dark:bg-primary-900 dark:text-primary-100"
            aria-label="Cue project"
          >
            {activeProjects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <Button variant="primary" onClick={() => setComposerOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Capture
          </Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        {LANES.map(({ status, label, note, icon: LaneIcon }) => {
          const laneCues = byStatus(status);
          return (
            <section key={status} className="min-h-80 rounded-[1.35rem] border border-primary-200/80 bg-primary-100/35 p-3 dark:border-primary/10 dark:bg-primary-900/20">
              <header className="mb-3 flex items-center justify-between px-1.5 py-1">
                <div className="flex items-center gap-2">
                  <LaneIcon className="size-4 text-primary-700 dark:text-primary-300" />
                  <div>
                    <h2 className="text-sm font-semibold text-primary-900 dark:text-primary-100">{label}</h2>
                    <p className="text-[11px] text-primary-600 dark:text-primary-500">{note}</p>
                  </div>
                </div>
                <span className="grid size-6 place-items-center rounded-full bg-primary-200/80 text-[11px] font-semibold text-primary-700 dark:bg-primary/10 dark:text-primary-300">
                  {laneCues.length}
                </span>
              </header>
              <div className="grid gap-3">
                {laneCues.map((cue) => <CueCard cue={cue} key={cue.id} />)}
                {!isLoading && laneCues.length === 0 && (
                  <button type="button" onClick={() => setComposerOpen(true)} className="rounded-xl border border-dashed border-primary-300/90 px-4 py-7 text-center text-xs text-primary-600 transition-colors hover:border-primary-600 hover:text-primary-800 dark:border-primary/15 dark:text-primary-500 dark:hover:border-primary/40 dark:hover:text-primary-300">
                    Add a {status === "active" ? "working" : status} Cue
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {project && (
        <CueComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          accountId={account?.id}
          projectId={project.id}
        />
      )}
    </PageShell>
  );
}
