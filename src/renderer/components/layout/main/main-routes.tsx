import { Routes, Route, Navigate } from "react-router-dom";
import Home from "@/routes/Home";
import Chat from "@/routes/Chat";
import Journal from "@/routes/Journal";
import Settings from "@/routes/Settings";
import Workspace from "@/routes/Workspace";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import ClaudePage from "@/routes/Claude";

function DefaultRoute() {
  const sidebarConfig = useSidebarConfig();
  
  // If the default route is not "/", redirect to it
  if (sidebarConfig.defaultRoute !== "/") {
    return <Navigate to={sidebarConfig.defaultRoute} replace />;
  }
  
  return <Home />;
}

export function MainRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DefaultRoute />} />
      <Route path="/chat/:id" element={<Chat />} />
      <Route path="/journal" element={<Journal />} />
      <Route path="/journal/:id" element={<Journal />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/workspace" element={<Workspace />} />
      <Route path="/workspace/:workspaceId" element={<Workspace />} />
      <Route path="/claude" element={<ClaudePage />} />
      <Route path="/claude/:id" element={<ClaudePage />} />
    </Routes>
  );
}
