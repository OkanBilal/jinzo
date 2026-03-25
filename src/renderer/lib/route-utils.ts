import { matchPath } from "react-router-dom";

export type RouteType =
  | "claude"
  | "copilot"
  | "codex"
  | "settings"
  | "home"
  | "unknown";

const ROUTE_PATTERNS = {
  claude: "/claude/:id?",
  copilot: "/copilot/:id?",
  codex: "/codex/:id?",
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

  return "unknown";
}

export function getBaseRoutePath(routeType: RouteType): string {
  switch (routeType) {
    case "claude":
      return "/claude";
    case "copilot":
      return "/copilot";
    case "codex":
      return "/codex";
    case "settings":
      return "/settings";
    case "home":
      return "/";
    default:
      return "/";
  }
}
