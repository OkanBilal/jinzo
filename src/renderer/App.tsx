import { useState } from "react";
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
import { ReduxProvider } from "./providers/redux-provider";
import { Toaster } from "./components/ui/toast/Toaster";

function AppContent() {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { mainMarginLeft, rightPanelWidth } = useLayoutConfig();
  const location = useLocation();
  const hideRightPanel = shouldHideRightPanel(location.pathname);

  return (
    <>
      <Toaster />
      <MainLayout>
        <Sidebar />
        <MainContent
          marginLeft={mainMarginLeft}
          marginRight={
            !hideRightPanel && isConfigOpen ? rightPanelWidth : "0.5rem"
          }
        >
          <MainRoutes />
        </MainContent>
        {!hideRightPanel && (
          <RightPanel
            isOpen={isConfigOpen}
            onToggle={setIsConfigOpen}
            width={rightPanelWidth}
          />
        )}
      </MainLayout>
    </>
  );
}

export default function App() {
  return (
    <ReduxProvider>
      <Router>
        <AppContent />
      </Router>
    </ReduxProvider>
  );
}
