import { matchPath } from "react-router-dom";

export type RouteType =
  | "claude"
  | "copilot"
  | "codex"
  | "cursor"
  | "settings"
  | "home"
  | "plugins"
  | "pulse"
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
  plugins: "/plugins",
  pulse: "/pulse",
} as const;

export function getRouteType(pathname: string): RouteType {
  if (pathname === "/") return "home";
  if (pathname === "/settings" || pathname.startsWith("/settings"))
    return "settings";

  if (matchPath(ROUTE_PATTERNS.claude, pathname)) return "claude";
  if (matchPath(ROUTE_PATTERNS.copilot, pathname)) return "copilot";
  if (matchPath(ROUTE_PATTERNS.codex, pathname)) return "codex";
  if (matchPath(ROUTE_PATTERNS.cursor, pathname)) return "cursor";
  if (matchPath(ROUTE_PATTERNS.plugins, pathname)) return "plugins";
  if (matchPath(ROUTE_PATTERNS.pulse, pathname)) return "pulse";

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
    case "plugins":
      return "/plugins";
    case "pulse":
      return "/pulse";
    default:
      return "/";
  }
}

/** Base URL segment for opening a workspace from the sidebar (e.g. `/codex`). Uses the current agent route when on one; otherwise the active space `defaultRoute` (plugins, home, unknown paths). */
export function getWorkspaceListBasePath(
  pathname: string,
  spaceDefaultRoute: string,
): string {
  const routeType = getRouteType(pathname);
  if (isWorkspaceRouteType(routeType)) {
    return getBaseRoutePath(routeType);
  }
  const raw = (spaceDefaultRoute || "/claude").trim().replace(/\/+$/, "");
  if (raw === "" || raw === "/") return "/claude";
  return raw;
}

/** Default HashRouter path from a space record (`uiConfig.sidebar.defaultRoute`). */
export function getSpaceDefaultRoute(space: {
  uiConfig: string | null;
}): string {
  if (!space.uiConfig) return "/";
  try {
    const config = JSON.parse(space.uiConfig) as {
      sidebar?: { defaultRoute?: string };
    };
    const route = config.sidebar?.defaultRoute;
    return typeof route === "string" && route.length > 0 ? route : "/";
  } catch {
    return "/";
  }
}
