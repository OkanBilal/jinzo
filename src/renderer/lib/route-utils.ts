import { matchPath } from "react-router-dom";

/**
 * Defines the main route types in the application
 */
export type RouteType =
  | "chat"
  | "claude"
  | "copilot"
  | "journal"
  | "settings"
  | "home"
  | "unknown";

/**
 * Route patterns for matching
 */
const ROUTE_PATTERNS = {
  chat: "/chat/:id?",
  claude: "/claude/:id?",
  copilot: "/copilot/:id?",
  journal: "/journal/:id?",
  settings: "/settings",
  home: "/",
} as const;

/**
 * Determines the route type from a pathname
 * Uses react-router's matchPath for accurate route matching
 */
export function getRouteType(pathname: string): RouteType {
  // Check exact matches first
  if (pathname === "/") return "home";
  if (pathname === "/settings" || pathname.startsWith("/settings"))
    return "settings";

  // Check pattern matches
  if (matchPath(ROUTE_PATTERNS.chat, pathname)) return "chat";
  if (matchPath(ROUTE_PATTERNS.claude, pathname)) return "claude";
  if (matchPath(ROUTE_PATTERNS.copilot, pathname)) return "copilot";
  if (matchPath(ROUTE_PATTERNS.journal, pathname)) return "journal";

  return "unknown";
}

/**
 * Gets the base route path for a route type
 */
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
