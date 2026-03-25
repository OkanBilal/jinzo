import { useLocation } from "react-router-dom";

type WorkspaceVariant = "claude" | "copilot" | "codex" | "default";

/**
 * Hook to determine the workspace variant based on the current route
 * @returns "claude" for /claude routes, "copilot" for /copilot routes, "codex" for /codex routes
 */
export function useWorkspaceVariant(): WorkspaceVariant {
  const location = useLocation();

  if (location.pathname.startsWith("/claude")) {
    return "claude";
  }

  if (location.pathname.startsWith("/copilot")) {
    return "copilot";
  }

  if (location.pathname.startsWith("/codex")) {
    return "codex";
  }

  return "default";
}
