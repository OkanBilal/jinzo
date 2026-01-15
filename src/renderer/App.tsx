import React, { useState, useMemo } from "react";
import { HashRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./routes/Home";
import Chat from "./routes/Chat";
import Feed from "./routes/Feed";
import FrostedSidebar from "./components/layout/side-bar";
import ConfigPanel from "./components/layout/config-panel";
import { Toaster } from "sonner";
import { ReduxProvider } from "./components/providers/redux-provider";
import { useActiveMood } from "./hooks/useActiveMood";
import { useTheme } from "./hooks/useTheme";

function AppContent() {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  const { activeMood } = useActiveMood();
  const theme = useTheme();

  const mainMarginLeft = useMemo(() => {
    if (activeMood?.uiConfig) {
      try {
        const config = JSON.parse(activeMood.uiConfig);
        return config.main?.margin || "18rem";
      } catch (error) {
        console.error("Failed to parse mood uiConfig:", error);
      }
    }
    return "18rem"; 
  }, [activeMood]);

  return (
    <Router>
      <div 
        className="app-root flex flex-col h-screen antialiased"
        style={{ 
          backgroundColor: theme.backgroundColor,
          transition: 'background-color 300ms ease-in-out'
        }}
      >
        <div
          className="fixed top-0 left-0 right-0 h-8 z-50"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        />
        <div className="flex h-full">
          <FrostedSidebar />
          <ConfigPanel isOpen={isConfigOpen} onToggle={setIsConfigOpen} />
          <Toaster richColors position="top-right" />
          <main
            className={`flex-1 m-2 overflow-hidden transition-all duration-300 ease-out ${
              isConfigOpen ? "mr-72" : ""
            }`}
            style={{ marginLeft: mainMarginLeft }}
          >
            <div className="h-full bg-primary dark:bg-primary-950 rounded-2xl overflow-auto">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/chat/:id" element={<Chat />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
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
