import { useState, useEffect, useMemo, useReducer, useCallback } from "react";
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
  const { defaultBranch, setupScript, runScript, archiveScript, commitInstructions, prInstructions, icon, iconMode, isIconPickerOpen, isDirty } = state;

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
          commitInstructions: commitInstructions || undefined,
          prInstructions: prInstructions || undefined,
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

  const setField = (field: "defaultBranch" | "setupScript" | "runScript" | "archiveScript" | "commitInstructions" | "prInstructions", value: string) =>
    dispatch({ type: "SET_FIELD", field, value });

  const [importing, setImporting] = useState(false);

  const handleImportPrTemplate = useCallback(async () => {
    if (!project?.rootPath || importing) return;
    setImporting(true);
    try {
      const paths = [
        `${project.rootPath}/.github/PULL_REQUEST_TEMPLATE.md`,
        `${project.rootPath}/.github/pull_request_template.md`,
        `${project.rootPath}/PULL_REQUEST_TEMPLATE.md`,
        `${project.rootPath}/pull_request_template.md`,
      ];
      for (const path of paths) {
        const result = await window.api.fileExplorer.readFile(path);
        if (result?.success && result.data) {
          setField("prInstructions", result.data);
          toast.success("PR template imported");
          return;
        }
      }
      toast.error("No PR template found in repository");
    } catch {
      toast.error("Failed to read PR template");
    } finally {
      setImporting(false);
    }
  }, [project?.rootPath, importing]);

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
          description="The main repository directory for this project."
        >
          {formatPath(project.rootPath)}
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          variant="detail"
          title="Workspaces path"
          description={
            project.workspacesPath
              ? "Directory where workspace worktrees are stored."
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
          title="Setup"
          description="Runs after a new workspace is created, e.g. installing dependencies."
        >
          <Textarea
            value={setupScript}
            onChange={(e) => setField("setupScript", e.target.value)}
            placeholder="e.g., npm i && npm run build"
            rows={2}
            className="min-w-0"
          />
        </SettingsRow>
        {/* <SettingsDivider />
        <SettingsRow
          variant="detail"
          title="Run script"
          description="Runs when a workspace session starts, e.g. starting a dev server."
        >
          <Textarea
            value={runScript}
            onChange={(e) => setField("runScript", e.target.value)}
            placeholder="e.g., npm run start"
            rows={2}
            className="min-w-0"
          />
        </SettingsRow> */}
        <SettingsDivider />
        <SettingsRow
          variant="detail"
          title="Archive"
          description="Runs when archiving a workspace, e.g. cleaning up node_modules."
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

      <SettingsSection title="Instructions">
        <SettingsRow
          variant="detail"
          title="Commit Instructions"
          description="Instructions prepended to commit goals. Overrides global setting if provided."
        >
          <Textarea
            value={commitInstructions}
            onChange={(e) => setField("commitInstructions", e.target.value)}
            placeholder="Overrides global setting if provided"
            rows={3}
            className="min-w-0"
          />
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          variant="detail"
          title="PR Template Instructions"
          description="Instructions prepended to PR goals. Overrides global setting if provided."
        >
          <div className="flex flex-col gap-2 min-w-0 w-full">
            <Textarea
              value={prInstructions}
              onChange={(e) => setField("prInstructions", e.target.value)}
              placeholder="Overrides global setting if provided"
              rows={3}
              className="min-w-0"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={importing}
                isLoading={importing}
                onClick={handleImportPrTemplate}
              >
                Import from repo
              </Button>
            </div>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Danger Zone">
        <SettingsRow
          variant="detail"
          title="Remove project"
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
