import { matchPath } from "react-router-dom";

export type RouteType =
  | "claude"
  | "copilot"
  | "codex"
  | "cursor"
  | "settings"
  | "home"
  | "unknown";

export type WorkspaceRouteType = Extract<
  RouteType,
  "claude" | "copilot" | "codex" | "cursor"
>;

export type WorkspaceVariant = WorkspaceRouteType | "default";

const ROUTE_PATTERNS = {
  claude: "/claude/:id?",
  copilot: "/copilot/:id?",
  codex: "/codex/:id?",
  cursor: "/cursor/:id?",
  settings: "/settings",
  home: "/",
} as const;

export function getRouteType(pathname: string): RouteType {
  if (pathname === "/") return "home";
  if (pathname === "/settings" || pathname.startsWith("/settings"))
    return "settings";

  if (matchPath(ROUTE_PATTERNS.claude, pathname)) return "claude";
  if (matchPath(ROUTE_PATTERNS.copilot, pathname)) return "copilot";
  if (matchPath(ROUTE_PATTERNS.codex, pathname)) return "codex";
  if (matchPath(ROUTE_PATTERNS.cursor, pathname)) return "cursor";

  return "unknown";
}

export function isWorkspaceRouteType(routeType: RouteType): routeType is WorkspaceRouteType {
  return routeType === "claude" || routeType === "copilot" || routeType === "codex" || routeType === "cursor";
}

export function getWorkspaceVariant(pathname: string): WorkspaceVariant {
  const routeType = getRouteType(pathname);
  return isWorkspaceRouteType(routeType) ? routeType : "default";
}

export function getBaseRoutePath(routeType: RouteType): string {
  switch (routeType) {
    case "claude":
      return "/claude";
    case "copilot":
      return "/copilot";
    case "codex":
      return "/codex";
    case "cursor":
      return "/cursor";
    case "settings":
      return "/settings";
    case "home":
      return "/";
    default:
      return "/";
  }
}
