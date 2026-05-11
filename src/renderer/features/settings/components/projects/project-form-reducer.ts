import { parseIcon } from "@/lib/icon-registry";

export type IconPickerMode = "emoji" | "icon";

export interface FormState {
  defaultBranch: string;
  setupScript: string;
  runScript: string;
  archiveScript: string;
  commitInstructions: string;
  prInstructions: string;
  icon: string;
  iconMode: IconPickerMode;
  isIconPickerOpen: boolean;
  isDirty: boolean;
  liveBranches: string[];
  prevProject: any;
}

export type FormAction =
  | { type: "SYNC_PROJECT"; project: any }
  | { type: "SET_FIELD"; field: "defaultBranch" | "setupScript" | "runScript" | "archiveScript" | "commitInstructions" | "prInstructions"; value: string }
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
  if (parsed.type === "icon") {
    return { icon: iconStr.toLowerCase(), iconMode: "icon" };
  }
  return { icon: typeof parsed.value === "string" ? parsed.value : "", iconMode: "emoji" };
}

export const initialFormState: FormState = {
  defaultBranch: "",
  setupScript: "",
  runScript: "",
  archiveScript: "",
  commitInstructions: "",
  prInstructions: "",
  icon: "",
  iconMode: "emoji",
  isIconPickerOpen: false,
  isDirty: false,
  liveBranches: [],
  prevProject: undefined,
};

export function formReducer(state: FormState, action: FormAction): FormState {
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
        commitInstructions: action.project?.commitInstructions ?? "",
        prInstructions: action.project?.prInstructions ?? "",
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
