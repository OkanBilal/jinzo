import type { WorkspaceStatus } from "@/lib/redux/api/workspacesApi";

interface WorkspaceStatusConfig {
  label: string;
  color: string; 
  iconColor: string; 
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
    color: "text-orange-600 dark:text-amber-400",
    iconColor: "text-amber-500 dark:text-amber-400",
  },
  in_review: {
    label: "In Review",
    color: "text-green-600 dark:text-green-600",
    iconColor: "text-green-500 dark:text-green-600",
  },
  done: {
    label: "Done",
    color: "text-indigo-500 dark:text-indigo-500",
    iconColor: "text-indigo-500 dark:text-indigo-500",
  },
  canceled: {
    label: "Canceled",
    color: "text-red-600 dark:text-red-500",
    iconColor: "text-red-500 dark:text-red-500",
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
