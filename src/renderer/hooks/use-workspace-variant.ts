import { useMemo } from "react";
import { useRouteType } from "./use-route-type";
import { isWorkspaceRouteType, type WorkspaceVariant } from "@/lib/route-utils";

/**
 * Returns the active workspace variant ("claude" / "copilot" / "codex" / "cursor"),
 * or "default" on non-workspace routes. Derived from `useRouteType` to avoid
 * parsing the pathname twice when both hooks are active in the tree.
 */
export function useWorkspaceVariant(): WorkspaceVariant {
  const routeType = useRouteType();
  return useMemo(
    () => (isWorkspaceRouteType(routeType) ? routeType : "default"),
    [routeType],
  );
}
