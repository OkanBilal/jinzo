import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "@/routes/Home";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { useActiveSpace } from "@/hooks/use-active-space";
import CodePage from "@/routes/Code";

// Off the boot path (`/` lands on the workspace page, so it stays eager).
// Loading these lazily keeps their feature graphs out of the startup script
// eval.
const Settings = lazy(() => import("@/routes/Settings"));
const PluginsPage = lazy(() => import("@/routes/Plugins"));
const Pulse = lazy(() => import("@/routes/Pulse"));
const Relay = lazy(() => import("@/routes/Relay"));
const Tasks = lazy(() => import("@/routes/Tasks"));

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
        <Route path="/code" element={<CodePage />} />
        <Route path="/code/runs/:runId" element={<CodePage />} />
        <Route path="/code/:workspaceId" element={<CodePage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="/pulse" element={<Pulse />} />
        <Route path="/relay" element={<Relay />} />
        <Route path="/tasks" element={<Tasks />} />
      </Routes>
    </Suspense>
  );
}
