import { useState } from "react";
import { HashRouter as Router, useLocation } from "react-router-dom";
import { ReduxProvider } from "./components/providers/redux-provider";
import { Toaster } from "./components/toast";
import Sidebar from "./components/layout/sidebar";
import RightPanel from "./components/layout/right-panel";
import {
  MoodChangeHandler,
  MainRoutes,
  MainLayout,
  MainContent,
} from "./components/layout/main";
import { useLayoutConfig } from "./hooks/useLayoutConfig";

function AppContent() {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { mainMarginLeft, rightPanelWidth } = useLayoutConfig();
  const location = useLocation();
  
  const isSettingsPage = location.pathname === "/settings" || location.pathname.startsWith("/workspace") || location.pathname.startsWith("/claude"); // TODO refine this condition

  return (
    <>
      <MoodChangeHandler />
      <Toaster />
      <MainLayout>
        <Sidebar />
        <MainContent
          marginLeft={mainMarginLeft}
          marginRight={!isSettingsPage && isConfigOpen ? rightPanelWidth : "0.5rem"}
        >
          <MainRoutes />
        </MainContent>
        {!isSettingsPage && (
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
