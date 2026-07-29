const ROUTES_WITHOUT_RIGHT_PANEL = ["/settings", "/plugins", "/pulse", "/relay"];

export function shouldHideRightPanel(pathname: string): boolean {
  return ROUTES_WITHOUT_RIGHT_PANEL.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * How long the sidebar / right-panel slide takes, in ms. The panels animate via
 * a Tailwind `duration-200` class, which can't read this constant — so any
 * change here must be mirrored in `sidebar.tsx` and `panel.tsx`. JS timers that
 * unmount a panel derive from this value so they never fire mid-transition.
 */
export const LAYOUT_PANEL_ANIM_MS = 200;

/**
 * Layout widths are driven at runtime through these CSS custom properties
 * (see `index.css` for the static fallbacks). Persisted values live in the
 * `appSettings` redux slice and are mirrored onto `:root` by
 * `useLayoutWidthVars`. Widths are stored as plain pixel numbers.
 */
export const SIDEBAR_WIDTH_VAR = "--sidebar-width";
export const PANEL_WIDTH_VAR = "--panel-width";

export const SIDEBAR_WIDTH_DEFAULT = 288; // 18rem
export const SIDEBAR_WIDTH_MIN = 244;
export const SIDEBAR_WIDTH_MAX = 420;

export const PANEL_WIDTH_DEFAULT = 352; // 22rem
export const PANEL_WIDTH_MIN = 300;
export const PANEL_WIDTH_MAX = 500;

export const BROWSER_PANEL_WIDTH_VAR = "--browser-panel-width";
export const BROWSER_PANEL_WIDTH_DEFAULT = 608; // 38rem
export const BROWSER_PANEL_WIDTH_MIN = 420;
export const BROWSER_PANEL_WIDTH_MAX = 960;

export const DOC_VIEWER_PANEL_WIDTH_VAR = "--doc-viewer-panel-width";
export const DOC_VIEWER_PANEL_WIDTH_DEFAULT = 720; // 45rem
export const DOC_VIEWER_PANEL_WIDTH_MIN = 480;
export const DOC_VIEWER_PANEL_WIDTH_MAX = 1100;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
