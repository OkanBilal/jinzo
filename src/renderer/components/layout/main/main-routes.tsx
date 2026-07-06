import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "@/routes/Home";
import Copilot from "@/routes/Copilot";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { useActiveSpace } from "@/hooks/use-active-space";
import ClaudePage from "@/routes/Claude";
import CodexPage from "@/routes/Codex";
import CursorPage from "@/routes/Cursor";

// Off the boot path (`/` lands on a workspace page; the agent routes all share
// WorkspaceProviderPage, so they stay eager). Loading these lazily keeps their
// feature graphs out of the startup script eval.
const Settings = lazy(() => import("@/routes/Settings"));
const PluginsPage = lazy(() => import("@/routes/Plugins"));
const Pulse = lazy(() => import("@/routes/Pulse"));
const Relay = lazy(() => import("@/routes/Relay"));

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
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<DefaultRoute />} />
        <Route path="/claude" element={<ClaudePage />} />
        <Route path="/claude/:workspaceId" element={<ClaudePage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="/pulse" element={<Pulse />} />
        <Route path="/relay" element={<Relay />} />
        <Route path="/copilot" element={<Copilot />} />
        <Route path="/copilot/:workspaceId" element={<Copilot />} />
        <Route path="/codex" element={<CodexPage />} />
        <Route path="/codex/:workspaceId" element={<CodexPage />} />
        <Route path="/cursor" element={<CursorPage />} />
        <Route path="/cursor/:workspaceId" element={<CursorPage />} />
      </Routes>
    </Suspense>
  );
}
