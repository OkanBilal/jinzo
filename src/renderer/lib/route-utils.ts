import { matchPath } from "react-router-dom";

export type RouteType =
  | "chat"
  | "claude"
  | "copilot"
  | "journal"
  | "settings"
  | "home"
  | "unknown";

const ROUTE_PATTERNS = {
  chat: "/chat/:id?",
  claude: "/claude/:id?",
  copilot: "/copilot/:id?",
  journal: "/journal/:id?",
  settings: "/settings",
  home: "/",
} as const;

export function getRouteType(pathname: string): RouteType {
  if (pathname === "/") return "home";
  if (pathname === "/settings" || pathname.startsWith("/settings"))
    return "settings";

  if (matchPath(ROUTE_PATTERNS.chat, pathname)) return "chat";
  if (matchPath(ROUTE_PATTERNS.claude, pathname)) return "claude";
  if (matchPath(ROUTE_PATTERNS.copilot, pathname)) return "copilot";
  if (matchPath(ROUTE_PATTERNS.journal, pathname)) return "journal";

  return "unknown";
}

export function getBaseRoutePath(routeType: RouteType): string {
  switch (routeType) {
    case "chat":
      return "/chat";
    case "claude":
      return "/claude";
    case "copilot":
      return "/copilot";
    case "journal":
      return "/journal";
    case "settings":
      return "/settings";
    case "home":
      return "/";
    default:
      return "/";
  }
}
