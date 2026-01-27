/**
 * Layout utility functions
 */

const ROUTES_WITHOUT_RIGHT_PANEL = ["/settings", "/claude"];

/**
 * Determines if the right panel should be hidden based on the current pathname
 */
export function shouldHideRightPanel(pathname: string): boolean {
  return ROUTES_WITHOUT_RIGHT_PANEL.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}
