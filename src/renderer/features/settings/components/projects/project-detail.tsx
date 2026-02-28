import { useState, useEffect, useMemo, useReducer } from "react";
import { useSearchParams } from "react-router-dom";
import { Heading2, Muted } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import Alert from "@/components/ui/alert";
import {
  useGetProjectByIdQuery,
  useUpdateProjectMutation,
  useRemoveProjectMutation,
} from "@/lib/redux/api";
import { SettingsSection, SettingsRow, SettingsDivider } from "../settings-layout";
import SpaceIconPicker from "@/components/layout/sidebar/space-icon-picker";
import { LinkResourcesModal } from "@/features/workspace/components/link-resources-modal";
import { formReducer, initialFormState } from "./project-form-reducer";
import { ProjectLinkedResources } from "./project-linked-resources";

interface ProjectDetailProps {
  id: string;
}

export default function ProjectDetail({ id }: ProjectDetailProps) {
  const [, setSearchParams] = useSearchParams();
  const { data: project, isLoading, refetch } = useGetProjectByIdQuery(id);
  const [updateProject, { isLoading: saving }] = useUpdateProjectMutation();
  const [removeProject, { isLoading: removing }] = useRemoveProjectMutation();
  const [showRemoveAlert, setShowRemoveAlert] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const { defaultBranch, setupScript, runScript, archiveScript, icon, iconMode, isIconPickerOpen, isDirty } = state;

  // Sync form state when project data loads
  if (project !== state.prevProject) {
    dispatch({ type: "SYNC_PROJECT", project });
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
          dispatch({ type: "SET_BRANCHES", branches: names });
        }
      })
      .catch(() => {});
  }, [project?.rootPath]);

  const handleSave = async () => {
    if (saving || !project) return;
    try {
      const iconValue = icon
        ? iconMode === "icon"
          ? `icon:${icon}`
          : `emoji:${icon}`
        : null;

      await updateProject({
        id: project.id,
        payload: {
          defaultBranch: defaultBranch || undefined,
          setupScript: setupScript || undefined,
          runScript: runScript || undefined,
          archiveScript: archiveScript || undefined,
          icon: iconValue,
        },
      }).unwrap();
      dispatch({ type: "MARK_CLEAN" });
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

  const handleRemove = async () => {
    if (removing || !project) return;
    try {
      await removeProject(project.id).unwrap();
      toast.success("Repository removed");
      setSearchParams({});
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove repository");
    } finally {
      setShowRemoveAlert(false);
    }
  };

  const setField = (field: "defaultBranch" | "setupScript" | "runScript" | "archiveScript", value: string) =>
    dispatch({ type: "SET_FIELD", field, value });

  const formatPath = (path: string) => {
    const parts = path.split("/");
    const last = parts.pop();
    const prefix = parts.join("/");
    return (
      <span className="text-s text-primary-500 dark:text-primary-400 ">
        {prefix && <>{prefix}/</>}
        <span className="font-semibold text-s text-primary-900 dark:text-primary-100">
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
    <div className="bg-primary dark:bg-primary-950 pb-16">
      <div className="mb-8">
        <Heading2 className="font-medium!">{project.name}</Heading2>
      </div>

      <SettingsSection>
        <SettingsRow
          variant="detail"
          title="Icon"
          description="Choose an emoji or icon for this project."
        >
          <SpaceIconPicker
            useFixedBackground
            icon={icon}
            iconMode={iconMode}
            isOpen={isIconPickerOpen}
            onToggle={() => dispatch({ type: "SET_ICON_PICKER_OPEN", isOpen: !isIconPickerOpen })}
            onSelectEmoji={(emoji) => dispatch({ type: "SET_ICON", icon: emoji, iconMode: "emoji" })}
            onSelectIcon={(name) => dispatch({ type: "SET_ICON", icon: name, iconMode: "icon" })}
            onSwitchMode={(mode) => dispatch({ type: "SET_ICON_MODE", iconMode: mode })}
            onClose={() => dispatch({ type: "SET_ICON_PICKER_OPEN", isOpen: false })}
            onClear={() => dispatch({ type: "SET_ICON", icon: "", iconMode: "emoji" })}
          />
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          variant="detail"
          title="Root path"
          description="Do not move or delete this directory."
        >
          {formatPath(project.rootPath)}
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          variant="detail"
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
      </SettingsSection>

      <ProjectLinkedResources
        projectId={id}
        onManageClick={() => setShowLinkModal(true)}
      />

      <SettingsSection title="Scripts">
        <SettingsRow
          variant="detail"
          title="Setup script"
          description="Runs when a new workspace is created."
        >
          <Textarea
            value={setupScript}
            onChange={(e) => setField("setupScript", e.target.value)}
            placeholder="e.g., npm install"
            rows={2}
            className="min-w-0"
          />
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          variant="detail"
          title="Run script"
          description="Runs when a workspace session starts."
        >
          <Textarea
            value={runScript}
            onChange={(e) => setField("runScript", e.target.value)}
            placeholder="e.g., npm run dev"
            rows={2}
            className="min-w-0"
          />
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          variant="detail"
          title="Archive script"
          description="Runs when a workspace is archived."
        >
          <Textarea
            value={archiveScript}
            onChange={(e) => setField("archiveScript", e.target.value)}
            placeholder="e.g., rm -rf node_modules"
            rows={2}
            className="min-w-0"
          />
        </SettingsRow>
      </SettingsSection>

      <div className="flex items-center justify-between pt-2 mb-8">
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

      <SettingsSection title="Danger Zone">
        <SettingsRow
          variant="detail"
          title="Remove repository"
          description="Permanently deletes this project, all associated workspaces, and their worktree files."
        >
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={() => setShowRemoveAlert(true)}
            disabled={removing}
          >
            Remove
          </Button>
        </SettingsRow>
      </SettingsSection>

      <Alert
        isOpen={showRemoveAlert}
        title="Remove repository?"
        description={`This will permanently delete "${project.name}", all its workspaces, and remove any worktree files from disk. This action cannot be undone.`}
        primaryButtonText="Remove"
        secondaryButtonText="Cancel"
        onPrimary={handleRemove}
        onSecondary={() => setShowRemoveAlert(false)}
        isPrimaryLoading={removing}
      />

      <LinkResourcesModal
        projectId={id}
        workspaceName={project.name}
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
      />
    </div>
  );
}
