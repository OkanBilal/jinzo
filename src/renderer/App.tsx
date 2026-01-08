import React from "react";
import { HashRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./routes/Home";
import Chat from "./routes/Chat";
import Feed from "./routes/Feed";
import Sidebar from "./components/layout/sidebar";
import ConfigPanel from "./components/layout/config-panel";
import { Toaster } from "sonner";
import { ReduxProvider } from "./components/providers/redux-provider";

export default function App() {
  return (
    <ReduxProvider>
      <Router>
        <div className="flex h-screen dark:bg-primary-950 bg-primary-50 antialiased">
          <Sidebar />
          <ConfigPanel />
          <Toaster richColors position="top-right" />
          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/chat/:id" element={<Chat />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ReduxProvider>
  );
}
