import React, { useState } from "react";
import { HashRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./routes/Home";
import Chat from "./routes/Chat";
import Feed from "./routes/Feed";
import FrostedSidebar from "./components/layout/side-bar";
import ConfigPanel from "./components/layout/config-panel";
import { Toaster } from "sonner";
import { ReduxProvider } from "./components/providers/redux-provider";

export default function App() {
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  return (
    <ReduxProvider>
      <Router>
        <div className="flex flex-col h-screen dark:bg-primary-950/50 antialiased">
          <div
            className="fixed top-0 left-0 right-0 h-8 z-50"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          />
          <div className="flex h-full">
            <FrostedSidebar />
            <ConfigPanel isOpen={isConfigOpen} onToggle={setIsConfigOpen} />
            <Toaster richColors position="top-right" />
            <main
              className={`flex-1 ml-72 m-2 overflow-hidden transition-all duration-300 ease-out ${
                isConfigOpen ? "mr-72" : ""
              }`}
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
    </ReduxProvider>
  );
}
