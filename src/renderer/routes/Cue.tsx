import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Heading3, Muted, Select } from "@/components/ui";
import { ArchiveCheck, ArrowUp, Inbox, Project } from "@/components/ui/icons";
import { PageShell } from "@/components/layout/page-shell";
import { useGetAccountQuery } from "@/lib/redux/api/accountApi";
import { useListProjectsQuery } from "@/lib/redux/api/projectsApi";
import { useListCuesByProjectQuery, type Cue, type CueStatus } from "@/lib/redux/api/cuesApi";
import { CueCard } from "@/features/cues/components/cue-card";
import { CueComposer } from "@/features/cues/components/cue-composer";
import { Bolt } from "@/components/ui/icons/space";

const LANES: Array<{ status: CueStatus; label: string; note: string; icon: typeof Inbox }> = [
  { status: "inbox", label: "Inbox", note: "Keep it close", icon: Inbox },
  { status: "active", label: "In motion", note: "What you are using", icon: Bolt },
  { status: "done", label: "Archived", note: "Saved for later", icon: ArchiveCheck },
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
  const [openStatus, setOpenStatus] = useState<CueStatus | null>("inbox");

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
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>

          <Heading3>Cue</Heading3>
          <Muted className="mt-1 max-w-xl">A durable shelf for prompts, loose ends, and useful fragments — tied to a project, never a disposable worktree.</Muted>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={project?.id ?? ""}
            onChange={(id) => navigate(`/cue/${id}`)}
            options={activeProjects.map((item) => ({ value: item.id, label: item.name }))}
            title="Project"
          />
          <Button variant="primary" onClick={() => setComposerOpen(true)} className="gap-1.5 py-2">

            Capture
          </Button>
        </div>
      </header>

      <div className="grid gap-6 ">
        {LANES.map(({ status, label, note, icon: LaneIcon }) => {
          const laneCues = byStatus(status);
          const isOpen = openStatus === status;
          return (
            <section key={status} className="overflow-hidden rounded-3xl glass-card">
              <Button
                variant="bare"
                onClick={() => setOpenStatus(isOpen ? null : status)}
                aria-expanded={isOpen}
                aria-controls={`cue-lane-${status}`}
                className="group flex w-full items-center gap-4 px-5 py-3 text-left transition-colors"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl glass-button">
                  <LaneIcon className="size-4 text-primary-800 dark:text-primary-200" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-primary-950 dark:text-primary-50">{label}</h2>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums glass-button text-primary-700 dark:text-primary-200">
                      {laneCues.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-primary-600 dark:text-primary-400">{note}</p>
                </div>
                <ArrowUp className={`size-4 text-primary-600 transition-transform duration-200 dark:text-primary-300 ${isOpen ? "rotate-180" : "rotate-90"}`} />
              </Button>

              <div
                id={`cue-lane-${status}`}
                className={`grid transition-[grid-template-rows] duration-250 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="flex  gap-3 overflow-x-auto px-5 py-3 noscrollbar">
                    {laneCues.map((cue) => <CueCard cue={cue} key={cue.id} />)}

                  </div>
                </div>
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
