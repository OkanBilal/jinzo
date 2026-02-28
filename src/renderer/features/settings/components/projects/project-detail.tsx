import { useState, useEffect, useMemo, useReducer } from "react";
import { useSearchParams } from "react-router-dom";
import { Heading2, Muted, Caption } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import Alert from "@/components/ui/alert";
import {
  useGetProjectByIdQuery,
  useUpdateProjectMutation,
  useRemoveProjectMutation,
  useGetProjectResourcesQuery,
  useRemoveProjectResourceMutation,
} from "@/lib/redux/api";
import { SettingsSection, SettingsRow, SettingsDivider } from "../settings-layout";
import SpaceIconPicker from "@/components/layout/sidebar/space-icon-picker";
import { parseIcon } from "@/lib/icon-registry";
import { LinkResourcesModal } from "@/features/workspace/components/link-resources-modal";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";
import { Apps, Asana, Gitlab, Jira, Close, Plus } from "@/components/ui/icons";

type IconPickerMode = "emoji" | "icon";

interface FormState {
  defaultBranch: string;
  setupScript: string;
  runScript: string;
  archiveScript: string;
  icon: string;
  iconMode: IconPickerMode;
  isIconPickerOpen: boolean;
  isDirty: boolean;
  liveBranches: string[];
  prevProject: any;
}

type FormAction =
  | { type: "SYNC_PROJECT"; project: any }
  | { type: "SET_FIELD"; field: "defaultBranch" | "setupScript" | "runScript" | "archiveScript"; value: string }
  | { type: "SET_ICON"; icon: string; iconMode: IconPickerMode }
  | { type: "SET_ICON_PICKER_OPEN"; isOpen: boolean }
  | { type: "SET_ICON_MODE"; iconMode: IconPickerMode }
  | { type: "SET_BRANCHES"; branches: string[] }
  | { type: "MARK_CLEAN" };

function parseProjectIcon(iconStr: string | null | undefined): { icon: string; iconMode: IconPickerMode } {
  if (!iconStr) return { icon: "", iconMode: "emoji" };
  if (iconStr.startsWith("icon:")) {
    return { icon: iconStr.replace("icon:", ""), iconMode: "icon" };
  }
  if (iconStr.startsWith("emoji:")) {
    return { icon: iconStr.replace("emoji:", ""), iconMode: "emoji" };
  }
  const parsed = parseIcon(iconStr);
  if (parsed.type === "icon" || parsed.type === "copilot-animate" || parsed.type === "claude-animate") {
    return { icon: iconStr.toLowerCase(), iconMode: "icon" };
  }
  return { icon: typeof parsed.value === "string" ? parsed.value : "", iconMode: "emoji" };
}

const initialState: FormState = {
  defaultBranch: "",
  setupScript: "",
  runScript: "",
  archiveScript: "",
  icon: "",
  iconMode: "emoji",
  isIconPickerOpen: false,
  isDirty: false,
  liveBranches: [],
  prevProject: undefined,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SYNC_PROJECT": {
      const { icon, iconMode } = parseProjectIcon(action.project?.icon);
      return {
        ...state,
        prevProject: action.project,
        defaultBranch: action.project?.defaultBranch ?? "",
        setupScript: action.project?.setupScript ?? "",
        runScript: action.project?.runScript ?? "",
        archiveScript: action.project?.archiveScript ?? "",
        icon,
        iconMode,
        isIconPickerOpen: false,
        isDirty: false,
      };
    }
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, isDirty: true };
    case "SET_ICON":
      return { ...state, icon: action.icon, iconMode: action.iconMode, isIconPickerOpen: false, isDirty: true };
    case "SET_ICON_PICKER_OPEN":
      return { ...state, isIconPickerOpen: action.isOpen };
    case "SET_ICON_MODE":
      return { ...state, iconMode: action.iconMode };
    case "SET_BRANCHES":
      return { ...state, liveBranches: action.branches };
    case "MARK_CLEAN":
      return { ...state, isDirty: false };
  }
}

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
  const { data: linkedResources = [] } = useGetProjectResourcesQuery(id);
  const [removeResource] = useRemoveProjectResourceMutation();

  const [state, dispatch] = useReducer(formReducer, initialState);
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

  const handleRemoveResource = async (resourceId: string) => {
    try {
      await removeResource({ projectId: id, resourceId }).unwrap();
      toast.success("Resource removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove resource");
    }
  };

  const getResourceIcon = (kind: string) => {
    switch (kind) {
      case "github_repo":
        return <Github className="w-4 h-4 shrink-0" />;
      case "linear_team":
        return <Linear className="w-4 h-4 shrink-0" />;
      case "jira_project":
        return <Jira className="size-5 shrink-0" />;
      case "asana_project":
        return <Asana className="h-5.5 w-6 scale-80 shrink-0" />;
      case "gitlab_project":
        return <Gitlab className="w-4 h-4 shrink-0" />;
      default:
        return <Apps className="w-4 h-4 shrink-0" />;
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

      <SettingsSection title="Linked Resources">
        {linkedResources.length === 0 ? (
          <div className="py-5">
            <Muted className="text-sm">No resources linked to this project.</Muted>
          </div>
        ) : (
          <div>
            {linkedResources.map((r, i) => (
              <div key={r.id}>
                {i > 0 && <SettingsDivider />}
                <div className="flex items-center gap-3 py-4">
                  <span className="text-primary-500 dark:text-primary-400 shrink-0">
                    {getResourceIcon(r.resource.kind)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-primary-900 dark:text-primary-100 truncate block">
                      {r.resource.name || r.resource.externalId}
                    </span>
                    {r.resource.externalId !== r.resource.name && (
                      <Caption className="text-primary-400 dark:text-primary-500 truncate block">
                        {r.resource.externalId}
                      </Caption>
                    )}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 p-1.5 rounded-full hover:bg-primary-200/60 dark:hover:bg-primary-800/60 transition-colors cursor-pointer"
                    onClick={() => handleRemoveResource(r.resourceId)}
                  >
                    <Close className="w-3 h-3 text-primary-400  transition-colors" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <SettingsDivider />
        <div className="py-4 flex justify-end">
          <Button
            type="button"
              variant="primary"
            className="flex items-center gap-1.5 "
            onClick={() => setShowLinkModal(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manage resources</span>
          </Button>
        </div>
      </SettingsSection>

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
