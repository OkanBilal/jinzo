import { HashRouter as Router, useLocation } from "react-router-dom";
import Sidebar from "./components/layout/sidebar";
import RightPanel from "./components/layout/right-panel";
import {
  MainRoutes,
  MainLayout,
  MainContent,
} from "./components/layout/main";
import { useLayoutConfig } from "./hooks/use-layout-config";
import { shouldHideRightPanel } from "./lib/layout";
import { useBottomTerminal, BottomTerminalProvider } from "./hooks/use-bottom-terminal";
import { useBrowserPanel, BrowserPanelProvider } from "./hooks/use-browser-panel";
import { BrowserPanel, BROWSER_PANEL_WIDTH } from "./features/workspace/components/browser-panel";
import { useWorkspaceVariant } from "./hooks/use-workspace-variant";
import { ReduxProvider } from "./providers/redux-provider";
import { Toaster } from "./components/ui/toast/Toaster";
import { useAppSelector, useAppDispatch } from "./lib/redux/hooks";
import { setSidebarCollapsed, setRightPanelOpen } from "./lib/redux/slices/appSettingsSlice";
import { SidebarToggleButton } from "./components/layout/sidebar/sidebar-toggle-button";
import { OnboardingModal } from "./features/onboarding/components/onboarding-modal";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { MainHeaderProvider } from "./hooks/use-main-header";

function AppContent() {
  const { mainMarginLeft, rightPanelWidth } = useLayoutConfig();
  const location = useLocation();
  const hideRightPanel = shouldHideRightPanel(location.pathname);
  const variant = useWorkspaceVariant();
  const bottomTerminal = useBottomTerminal();
  const browserPanel = useBrowserPanel();
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

  return (
    <>
      <Toaster />
      {!onboardingCompleted && <OnboardingModal open={true} />}
      <MainLayout>
        <SidebarToggleButton
          isOpen={!sidebarCollapsed}
          onClick={() => dispatch(setSidebarCollapsed(!sidebarCollapsed))}
        />
        <Sidebar collapsed={sidebarCollapsed} />
        <MainContent
          marginLeft={sidebarCollapsed ? "0.375rem" : mainMarginLeft}
          marginRight={
            browserPanel.isOpen
              ? BROWSER_PANEL_WIDTH
              : !hideRightPanel && isRightPanelOpen
                ? rightPanelWidth
                : "0.375rem"
          }
          hasRightPanel={!hideRightPanel && !isRightPanelOpen && !browserPanel.isOpen}
          browserOpen={browserPanel.isOpen}
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
              if (open) browserPanel.close();
              dispatch(setRightPanelOpen(open));
            }}
            width={rightPanelWidth}
            terminalOpen={showTerminalToggle ? bottomTerminal.isOpen : undefined}
            onTerminalToggle={showTerminalToggle ? bottomTerminal.toggle : undefined}
            browserOpen={showBrowserToggle ? browserPanel.isOpen : undefined}
            onBrowserToggle={showBrowserToggle ? () => {
              if (!browserPanel.isOpen) dispatch(setRightPanelOpen(false));
              browserPanel.toggle();
            } : undefined}
          />
        )}
        <BrowserPanel />
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
                <AppContent />
              </BrowserPanelProvider>
            </BottomTerminalProvider>
          </MainHeaderProvider>
        </Router>
      </ReduxProvider>
    </ErrorBoundary>
  );
}
