import { Routes, Route, Navigate } from "react-router-dom";
import Home from "@/routes/Home";
import Settings from "@/routes/Settings";
import Copilot from "@/routes/Copilot";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { useActiveSpace } from "@/hooks/use-active-space";
import ClaudePage from "@/routes/Claude";
import CodexPage from "@/routes/Codex";
import CursorPage from "@/routes/Cursor";
import PluginsPage from "@/routes/Plugins";

function DefaultRoute() {
  const { activeSpace } = useActiveSpace();
  const sidebarConfig = useSidebarConfig();

  if (!activeSpace) return null;

  if (sidebarConfig.defaultRoute !== "/") {
    return <Navigate to={sidebarConfig.defaultRoute} replace />;
  }

  return <Home />;
}

export function MainRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DefaultRoute />} />
      <Route path="/claude" element={<ClaudePage />} />
      <Route path="/claude/:workspaceId" element={<ClaudePage />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/plugins" element={<PluginsPage />} />
      <Route path="/copilot" element={<Copilot />} />
      <Route path="/copilot/:workspaceId" element={<Copilot />} />
      <Route path="/codex" element={<CodexPage />} />
      <Route path="/codex/:workspaceId" element={<CodexPage />} />
      <Route path="/cursor" element={<CursorPage />} />
      <Route path="/cursor/:workspaceId" element={<CursorPage />} />
    </Routes>
  );
}
