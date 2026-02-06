import { useLocation } from "react-router-dom";

type WorkspaceVariant = "claude" | "copilot" | "default";

/**
 * Hook to determine the workspace variant based on the current route
 * @returns "claude" for /claude routes, "copilot" for /copilot routes
 */
export function useWorkspaceVariant(): WorkspaceVariant {
  const location = useLocation();
  
  if (location.pathname.startsWith("/claude")) {
    return "claude";
  }

  if (location.pathname.startsWith("/copilot")) {
    return "copilot";
  }
  
  return "default";
}
