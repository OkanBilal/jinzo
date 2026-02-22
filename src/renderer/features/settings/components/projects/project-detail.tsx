import { useState, useEffect, useMemo, useReducer } from "react";
import { useSearchParams } from "react-router-dom";
import { Heading2, Heading3, Muted } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import Select from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import Alert from "@/components/ui/alert";
import {
  useGetProjectByIdQuery,
  useUpdateProjectMutation,
  useRemoveProjectMutation,
} from "@/lib/redux/api";
import { SettingsSection, SettingsRow, SettingsDivider } from "../settings-layout";
import MoodIconPicker from "@/components/layout/sidebar/mood-icon-picker";
import { parseIcon } from "@/lib/icon-registry";

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

  const [state, dispatch] = useReducer(formReducer, initialState);
  const { defaultBranch, setupScript, runScript, archiveScript, icon, iconMode, isIconPickerOpen, isDirty, liveBranches } = state;

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

  const branches =
    liveBranches.length > 0 ? liveBranches : (project?.branches ?? []);

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b, label: b })),
    [branches],
  );

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
          <MoodIconPicker
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
    </div>
  );
}
