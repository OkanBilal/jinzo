import { useEffect, useMemo, useState } from "react";
import { Heading2, Heading3, Muted } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import Select from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  useGetProjectByIdQuery,
  useUpdateProjectMutation,
} from "@/lib/redux/api";

interface ProjectDetailProps {
  id: string;
}

export default function ProjectDetail({ id }: ProjectDetailProps) {
  const { data: project, isLoading, refetch } = useGetProjectByIdQuery(id);
  const [updateProject, { isLoading: saving }] = useUpdateProjectMutation();

  const [defaultBranch, setDefaultBranch] = useState("");
  const [setupScript, setSetupScript] = useState("");
  const [runScript, setRunScript] = useState("");
  const [archiveScript, setArchiveScript] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [liveBranches, setLiveBranches] = useState<string[]>([]);

  // Sync form state when project data loads
  const [prevProject, setPrevProject] = useState(project);
  if (project !== prevProject) {
    setPrevProject(project);
    if (project) {
      setDefaultBranch(project.defaultBranch ?? "");
      setSetupScript(project.setupScript ?? "");
      setRunScript(project.runScript ?? "");
      setArchiveScript(project.archiveScript ?? "");
      setIsDirty(false);
    }
  }

  // Fetch live branches (local + remote) from git
  useEffect(() => {
    if (!project?.rootPath) return;
    window.api.git
      .getBranches(project.rootPath)
      .then((result: any) => {
        if (result?.success && result.data?.all) {
          const seen = new Set<string>();
          const names: string[] = [];
          for (const raw of result.data.all as string[]) {
            const name = raw.replace(/^remotes\/[^/]+\//, "");
            if (!seen.has(name)) {
              seen.add(name);
              names.push(name);
            }
          }
          setLiveBranches(names);
        }
      })
      .catch(() => {});
  }, [project?.rootPath]);

  const branches =
    liveBranches.length > 0 ? liveBranches : (project?.branches ?? []);

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b, label: b })),
    [branches],
  );

  const handleSave = async () => {
    if (saving || !project) return;
    try {
      await updateProject({
        id: project.id,
        payload: {
          defaultBranch: defaultBranch || undefined,
          setupScript: setupScript || undefined,
          runScript: runScript || undefined,
          archiveScript: archiveScript || undefined,
        },
      }).unwrap();
      setIsDirty(false);
      toast.success("Project settings saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save project settings");
    }
  };

  const lastSavedLabel = useMemo(() => {
    const ts = project?.updatedAt || project?.createdAt;
    if (!ts) return null;
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [project?.updatedAt, project?.createdAt]);

  const markDirty = () => setIsDirty(true);

  const formatPath = (path: string) => {
    const parts = path.split("/");
    const last = parts.pop();
    const prefix = parts.join("/");
    return (
      <span className="text-[13px] text-primary-500 dark:text-primary-400 ">
        {prefix && <>{prefix}/</>}
        <span className="font-semibold text-[13px] text-primary-900 dark:text-primary-100">
          {last}
        </span>
      </span>
    );
  };

  if (isLoading) {
    return (
      <div>
        <Heading2 className="mb-2 font-medium!">Project</Heading2>
        <Muted>Loading...</Muted>
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <Heading2 className="mb-2 font-medium!">Project</Heading2>
        <Muted>Project not found.</Muted>
      </div>
    );
  }

  return (
    <div className="space-y-2 bg-primary dark:bg-primary-950 pb-16">
      <div className="mb-8">
        <Heading2 className="font-medium!">{project.name}</Heading2>
      </div>

      <SettingsRow
        title="Root path"
        description="Do not move or delete this directory."
      >
        {formatPath(project.rootPath)}
      </SettingsRow>

      <SettingsDivider />

      <SettingsRow
        title="Workspaces path"
        description={
          project.workspacesPath
            ? "Do not move or delete the workspace subdirectories."
            : undefined
        }
      >
        {project.workspacesPath ? (
          formatPath(project.workspacesPath)
        ) : (
          <Muted>Not configured</Muted>
        )}
      </SettingsRow>

      {/* 
      TODO: will be back
            <SettingsDivider />

      <SettingsRow
        title="Branch new workspaces from"
        description="Each workspace is an isolated copy of your codebase."
      >
        {branchOptions.length > 0 ? (
          <Select
            useFixedBackground
            value={defaultBranch}
            options={branchOptions}
            onChange={(val) => {
              setDefaultBranch(val);
              markDirty();
            }}
            placeholder="Select branch"
          />
        ) : (
          <Muted>No branches available</Muted>
        )}
      </SettingsRow> */}

      {/* <SettingsDivider />
      TODO: will be back

      <SettingsRow
        title="Remote origin"
        description="Where should we push, pull, and create PRs?"
      >
        <span className="text-sm font-mono text-primary-500 dark:text-primary-400">
          {project.remoteOrigin}
        </span>
      </SettingsRow> */}

      <SettingsDivider />

      <SettingsRow
        title="Setup script"
        description="Runs when a new workspace is created."
      >
        <Textarea
          value={setupScript}
          onChange={(e) => {
            setSetupScript(e.target.value);
            markDirty();
          }}
          placeholder="e.g., npm install"
          rows={2}
          className="min-w-0"
        />
      </SettingsRow>

      <SettingsDivider />

      <SettingsRow
        title="Run script"
        description="Runs when a workspace session starts."
      >
        <Textarea
          value={runScript}
          onChange={(e) => {
            setRunScript(e.target.value);
            markDirty();
          }}
          placeholder="e.g., npm run dev"
          rows={2}
          className="min-w-0"
        />
      </SettingsRow>

      <SettingsDivider />

      <SettingsRow
        title="Archive script"
        description="Runs when a workspace is archived."
      >
        <Textarea
          value={archiveScript}
          onChange={(e) => {
            setArchiveScript(e.target.value);
            markDirty();
          }}
          placeholder="e.g., rm -rf node_modules"
          rows={2}
          className="min-w-0"
        />
      </SettingsRow>

      <SettingsDivider />

      <div className="flex items-center justify-between pt-6">
        <div className="text-xs text-primary-500 dark:text-primary-400">
          {lastSavedLabel ? `Last saved: ${lastSavedLabel}` : "Not saved yet"}
        </div>
        <div className="flex items-center gap-3">
          <Button
            tooltip="Refresh project details"
            type="button"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isLoading || saving}
          >
            Refresh
          </Button>
          <Button
            type="button"
            size="md"
            variant="submit"
            disabled={!isDirty || saving}
            isLoading={saving}
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-7 gap-8">
      <div className="shrink-0 w-80">
        <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-primary-500 dark:text-primary-500 mt-1.5">
            {description}
          </p>
        )}
      </div>
      <div className="flex-1  text-right flex justify-end">{children}</div>
    </div>
  );
}

function SettingsDivider() {
  return (
    <div className="border-b border-primary-200 dark:border-primary-800/50" />
  );
}
