import { useEffect } from "react";
import { HashRouter as Router, useLocation } from "react-router-dom";
import Sidebar from "./components/layout/sidebar";
import RightPanel from "./components/layout/right-panel";
import {
  MainRoutes,
  MainLayout,
  MainContent,
} from "./components/layout/main";
import { shouldHideRightPanel } from "./lib/layout";
import { useBottomTerminal, BottomTerminalProvider } from "./hooks/use-bottom-terminal";
import { useBrowserPanel, BrowserPanelProvider } from "./hooks/use-browser-panel";
import { BrowserPanel } from "./features/workspace/components/browser-panel";
import { useDocumentViewer, DocumentViewerProvider } from "./hooks/use-document-viewer";
import { DocumentViewerPanel } from "./features/workspace/components/document-viewer-panel";
import { useWorkspaceVariant } from "./hooks/use-workspace-variant";
import { ReduxProvider } from "./providers/redux-provider";
import { Toaster } from "./components/ui/toast/Toaster";
import { useAppSelector, useAppDispatch } from "./lib/redux/hooks";
import { isWeb, useIsMobile } from "./lib/platform";
import {
  setSidebarCollapsed,
  setRightPanelOpen,
  setOnboardingCompleted,
} from "./lib/redux/slices/appSettingsSlice";
import { SidebarToggleButton } from "./components/layout/sidebar/sidebar-toggle-button";
import { OnboardingModal } from "./features/onboarding/components/onboarding-modal";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { MainHeaderProvider } from "./hooks/use-main-header";
import { useLayoutWidthVars } from "./hooks/use-layout-width-vars";
import { PROVIDER_IDS, type ProviderId } from "../shared/provider-ids";

/** Layout widths live in CSS (`--sidebar-width`, `--panel-width`, `--browser-panel-width`) — see index.css. */
const SIDEBAR_WIDTH = "var(--sidebar-width)";
const RIGHT_PANEL_WIDTH = "var(--panel-width)";
const BROWSER_PANEL_WIDTH = "var(--browser-panel-width)";
const DOC_VIEWER_PANEL_WIDTH = "var(--doc-viewer-panel-width)";

function providerIdForVariant(variant: ReturnType<typeof useWorkspaceVariant>): ProviderId | undefined {
  switch (variant) {
    case "claude":
      return PROVIDER_IDS.claude;
    case "copilot":
      return PROVIDER_IDS.copilot;
    case "codex":
      return PROVIDER_IDS.codex;
    case "cursor":
      return PROVIDER_IDS.cursor;
    default:
      return undefined;
  }
}

function useDropdownAnimationPrewarm() {
  useEffect(() => {
    const el = document.createElement("div");
    el.className = "animate-dropdown-in";
    el.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;";
    document.body.appendChild(el);
    const id = window.setTimeout(() => el.remove(), 400);
    return () => {
      window.clearTimeout(id);
      el.remove();
    };
  }, []);
}

function AppContent() {
  useDropdownAnimationPrewarm();
  useLayoutWidthVars();
  const location = useLocation();
  const hideRightPanel = shouldHideRightPanel(location.pathname);
  const variant = useWorkspaceVariant();
  const activeProviderId = providerIdForVariant(variant);
  const bottomTerminal = useBottomTerminal();
  const browserPanel = useBrowserPanel();
  const docViewer = useDocumentViewer();
  const showTerminalToggle = variant !== "default";
  const showBrowserToggle = variant !== "default";
  const dispatch = useAppDispatch();
  const sidebarCollapsed = useAppSelector(
    (state) => state.appSettings.sidebarCollapsed,
  );
  const isRightPanelOpen = useAppSelector((state) => state.appSettings.rightPanelOpen);
  const onboardingCompleted = useAppSelector(
    (state) => state.appSettings.onboardingCompleted,
  );
  const isMobile = useIsMobile();

  // Mobile: the sidebar is an overlay drawer — auto-close on navigation (and on
  // entering mobile) so the selected content is visible. Local UI state only.
  useEffect(() => {
    if (isMobile) dispatch(setSidebarCollapsed(true));
  }, [isMobile, location.pathname, dispatch]);

  // Web skips onboarding (CLI setup is a backend concern), but onboardingCompleted
  // is a per-browser persisted flag that gates the space selector + composer.
  // Mark it complete so those render. Local-only; no backend write.
  useEffect(() => {
    if (isWeb && !onboardingCompleted) dispatch(setOnboardingCompleted(true));
  }, [onboardingCompleted, dispatch]);

  return (
    <>
      <Toaster />
      {/* Onboarding sets up local CLIs; in web those live on the backend, so skip it. */}
      {!onboardingCompleted && !isWeb && <OnboardingModal open={true} />}
      <MainLayout>
        {/* Mobile drawer scrims — tap to dismiss. Each sits just below its panel
            (sidebar z-30, right panel z-50) and above the full-width content. */}
        {isMobile && !sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-primary-950/40"
            style={{ zIndex: 20 }}
            onClick={() => dispatch(setSidebarCollapsed(true))}
            aria-hidden
          />
        )}
        {isMobile && !hideRightPanel && isRightPanelOpen && (
          <div
            className="fixed inset-0 bg-primary-950/40"
            style={{ zIndex: 45 }}
            onClick={() => dispatch(setRightPanelOpen(false))}
            aria-hidden
          />
        )}
        {!(
          isMobile &&
          ((!hideRightPanel && isRightPanelOpen) ||
            browserPanel.isOpen ||
            docViewer.isOpen)
        ) && (
          <SidebarToggleButton
            isOpen={!sidebarCollapsed}
            onClick={() => dispatch(setSidebarCollapsed(!sidebarCollapsed))}
          />
        )}
        <Sidebar collapsed={sidebarCollapsed} />
        <MainContent
          marginLeft={isMobile || sidebarCollapsed ? "0.375rem" : SIDEBAR_WIDTH}
          marginRight={
            isMobile
              ? "0.375rem"
              : docViewer.isOpen
                ? DOC_VIEWER_PANEL_WIDTH
                : browserPanel.isOpen
                  ? BROWSER_PANEL_WIDTH
                  : !hideRightPanel && isRightPanelOpen
                    ? RIGHT_PANEL_WIDTH
                    : "0.375rem"
          }
          hasRightPanel={
            !hideRightPanel && !isRightPanelOpen && !browserPanel.isOpen && !docViewer.isOpen
          }
          browserOpen={browserPanel.isOpen || docViewer.isOpen}
          sidebarCollapsed={sidebarCollapsed}
        >
          <ErrorBoundary level="route">
            <MainRoutes />
          </ErrorBoundary>
        </MainContent>
        {!hideRightPanel && (
          <RightPanel
            isOpen={isRightPanelOpen}
            onToggle={(open) => {
              if (open) {
                browserPanel.close();
                docViewer.close();
              }
              dispatch(setRightPanelOpen(open));
            }}
            width={RIGHT_PANEL_WIDTH}
            terminalOpen={showTerminalToggle ? bottomTerminal.isOpen : undefined}
            onTerminalToggle={showTerminalToggle ? bottomTerminal.toggle : undefined}
            browserOpen={showBrowserToggle ? browserPanel.isOpen : undefined}
            onBrowserToggle={showBrowserToggle ? () => {
              if (!browserPanel.isOpen) {
                dispatch(setRightPanelOpen(false));
                docViewer.close();
              }
              browserPanel.toggle();
            } : undefined}
            providerId={activeProviderId}
          />
        )}
        <BrowserPanel />
        <DocumentViewerPanel />
      </MainLayout>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary level="app">
      <ReduxProvider>
        <Router>
          <MainHeaderProvider>
            <BottomTerminalProvider>
              <BrowserPanelProvider>
                <DocumentViewerProvider>
                  <AppContent />
                </DocumentViewerProvider>
              </BrowserPanelProvider>
            </BottomTerminalProvider>
          </MainHeaderProvider>
        </Router>
      </ReduxProvider>
    </ErrorBoundary>
  );
}
