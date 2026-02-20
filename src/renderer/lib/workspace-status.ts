import type { WorkspaceStatus } from "@/lib/redux/api/workspacesApi";

interface WorkspaceStatusConfig {
  label: string;
  color: string; // tailwind text color class
  iconColor: string; // tailwind text color class for the status icon
}

const statusConfig: Record<WorkspaceStatus, WorkspaceStatusConfig> = {
  backlog: {
    label: "Backlog",
    color: "text-primary-500 dark:text-primary-400",
    iconColor: "text-primary-800 dark:text-primary-500",
  },
  todo: {
    label: "Todo",
    color: "text-blue-600 dark:text-blue-400",
    iconColor: "text-primary-800 dark:text-primary-300",
  },
  in_progress: {
    label: "In Progress",
    color: "text-amber-600 dark:text-amber-400",
    iconColor: "text-amber-500 dark:text-amber-400",
  },
  in_review: {
    label: "In Review",
    color: "text-purple-600 dark:text-purple-400",
    iconColor: "text-purple-500 dark:text-purple-400",
  },
  done: {
    label: "Done",
    color: "text-emerald-600 dark:text-emerald-400",
    iconColor: "text-emerald-500 dark:text-emerald-400",
  },
  canceled: {
    label: "Canceled",
    color: "text-red-600 dark:text-red-400",
    iconColor: "text-red-500 dark:text-red-400",
  },
  duplicate: {
    label: "Duplicate",
    color: "text-primary-400 dark:text-primary-500",
    iconColor: "text-primary-400 dark:text-primary-500",
  },
};

export function getWorkspaceStatusConfig(status: WorkspaceStatus): WorkspaceStatusConfig {
  return statusConfig[status] ?? statusConfig.todo;
}
