import type { Workspace } from "../types";
import { useRouteType } from "@/hooks/use-route-type";
import { ParticleLogoCanvas } from "./particle-logo-canvas";

interface WorkspaceEmptyStateProps {
  workspace: Workspace | null;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function WorkspaceEmptyState({ workspace }: WorkspaceEmptyStateProps) {
  const routeType = useRouteType();

  return (
    <div className="relative flex flex-col items-center justify-center h-full pb-6">
      <ParticleLogoCanvas
        className="w-125 h-70"
        routeType={routeType}
        text=""
      />
    </div>
  );
}
