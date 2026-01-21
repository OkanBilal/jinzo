import { useState } from "react";
import { HashRouter as Router } from "react-router-dom";
import { ReduxProvider } from "./components/providers/redux-provider";
import { Toaster } from "./components/toast";
import FrostedSidebar from "./components/layout/sidebar";
import ConfigPanel from "./components/layout/right-panel";
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

  return (
    <Router>
      <MoodChangeHandler />
      <Toaster />
      <MainLayout>
        <FrostedSidebar />
        <MainContent
          marginLeft={mainMarginLeft}
          marginRight={isConfigOpen ? rightPanelWidth : "0.5rem"}
        >
          <MainRoutes />
        </MainContent>
        <ConfigPanel
          isOpen={isConfigOpen}
          onToggle={setIsConfigOpen}
          width={rightPanelWidth}
        />
      </MainLayout>
    </Router>
  );
}

export default function App() {
  return (
    <ReduxProvider>
      <AppContent />
    </ReduxProvider>
  );
}
