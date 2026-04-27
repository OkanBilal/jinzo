import { useLocation } from "react-router-dom";
import { useMemo } from "react";
import { getWorkspaceVariant, type WorkspaceVariant } from "@/lib/route-utils";

/**
 * Hook to determine the workspace variant based on the current route
 * @returns "claude" for /claude routes, "copilot" for /copilot routes, "codex" for /codex routes, "cursor" for /cursor routes
 */
export function useWorkspaceVariant(): WorkspaceVariant {
  const location = useLocation();

  return useMemo(() => getWorkspaceVariant(location.pathname), [location.pathname]);
}
