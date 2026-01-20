import { useState } from "react";
import { HashRouter as Router } from "react-router-dom";
import { Toaster } from "sonner";
import { ReduxProvider } from "./components/providers/redux-provider";
import FrostedSidebar from "./components/layout/sidebar";
import ConfigPanel from "./components/layout/config-panel";
import {
  MoodChangeHandler,
  AppRoutes,
  AppLayout,
  MainContent,
} from "./components/app";
import { useLayoutConfig } from "./hooks/useLayoutConfig";

function AppContent() {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { mainMarginLeft, configPanelWidth } = useLayoutConfig();

  return (
    <Router>
      <MoodChangeHandler />
      <AppLayout>
        <FrostedSidebar />
        <ConfigPanel
          isOpen={isConfigOpen}
          onToggle={setIsConfigOpen}
          width={configPanelWidth}
        />
        <Toaster richColors position="top-right" />
        <MainContent
          marginLeft={mainMarginLeft}
          marginRight={isConfigOpen ? configPanelWidth : "0.5rem"}
        >
          <AppRoutes />
        </MainContent>
      </AppLayout>
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
