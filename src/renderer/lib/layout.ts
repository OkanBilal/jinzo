const ROUTES_WITHOUT_RIGHT_PANEL = ["/settings", "/claude"];

export function shouldHideRightPanel(pathname: string): boolean {
  return ROUTES_WITHOUT_RIGHT_PANEL.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}
