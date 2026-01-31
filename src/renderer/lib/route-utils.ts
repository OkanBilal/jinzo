import { matchPath } from "react-router-dom";

/**
 * Defines the main route types in the application
 */
export type RouteType = "chat" | "claude" | "workspace" | "journal" | "settings" | "home" | "unknown";

/**
 * Route patterns for matching
 */
const ROUTE_PATTERNS = {
  chat: "/chat/:id?",
  claude: "/claude/:id?",
  workspace: "/workspace/:id?",
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
  if (pathname === "/settings" || pathname.startsWith("/settings")) return "settings";
  
  // Check pattern matches
  if (matchPath(ROUTE_PATTERNS.chat, pathname)) return "chat";
  if (matchPath(ROUTE_PATTERNS.claude, pathname)) return "claude";
  if (matchPath(ROUTE_PATTERNS.workspace, pathname)) return "workspace";
  if (matchPath(ROUTE_PATTERNS.journal, pathname)) return "journal";
  
  return "unknown";
}

/**
 * Checks if the current route is a chat-like route (chat or claude)
 */
export function isChatRoute(pathname: string): boolean {
  const routeType = getRouteType(pathname);
  return routeType === "chat" || routeType === "claude";
}

/**
 * Checks if the current route is a workspace route
 */
export function isWorkspaceRoute(pathname: string): boolean {
  return getRouteType(pathname) === "workspace";
}

/**
 * Checks if the current route is claude
 */
export function isClaudeRoute(pathname: string): boolean {
  return getRouteType(pathname) === "claude";
}

/**
 * Checks if the current route is journal
 */
export function isJournalRoute(pathname: string): boolean {
  return getRouteType(pathname) === "journal";
}

/**
 * Checks if the current route is settings
 */
export function isSettingsRoute(pathname: string): boolean {
  return getRouteType(pathname) === "settings";
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
    case "workspace":
      return "/workspace";
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

/**
 * Builds a route path with an optional ID
 */
export function buildRoutePath(routeType: RouteType, id?: string): string {
  const basePath = getBaseRoutePath(routeType);
  if (id && basePath !== "/") {
    return `${basePath}/${id}`;
  }
  return basePath;
}
