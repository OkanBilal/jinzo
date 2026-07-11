import { matchPath } from "react-router-dom";
import { parseUiConfig } from "./parse-ui-config";

export type RouteType =
  | "code"
  | "settings"
  | "home"
  | "plugins"
  | "pulse"
  | "unknown";

const ROUTE_PATTERNS = {
  code: "/code/:id?",
  settings: "/settings",
  home: "/",
  plugins: "/plugins",
  pulse: "/pulse",
} as const;

/** Base path of the unified agent workspace route (all providers, space-driven). */
export const WORKSPACE_BASE_PATH = getBaseRoutePath("code");

export function getRouteType(pathname: string): RouteType {
  if (pathname === "/") return "home";
  if (pathname === "/settings" || pathname.startsWith("/settings"))
    return "settings";

  if (matchPath(ROUTE_PATTERNS.code, pathname)) return "code";
  if (matchPath(ROUTE_PATTERNS.plugins, pathname)) return "plugins";
  if (matchPath(ROUTE_PATTERNS.pulse, pathname)) return "pulse";

  return "unknown";
}

/**
 * Strip `/:id?` (or any param segment) off a route pattern to get the bare base.
 * Derived from `ROUTE_PATTERNS` so a new route only has to be registered there.
 */
export function getBaseRoutePath(routeType: RouteType): string {
  if (routeType === "unknown") return "/";
  return ROUTE_PATTERNS[routeType].split("/:")[0] || "/";
}

/** Default HashRouter path from a space record (`uiConfig.sidebar.defaultRoute`). */
export function getSpaceDefaultRoute(space: {
  uiConfig: string | null;
}): string {
  const route = parseUiConfig(space.uiConfig).sidebar?.defaultRoute;
  return typeof route === "string" && route.length > 0 ? route : "/";
}
