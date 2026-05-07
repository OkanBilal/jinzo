import { useState } from "react";
import type { Workspace } from "../types";
import { useRouteType } from "@/hooks/use-route-type";
import { useActiveSpace } from "@/hooks/use-active-space";
import { useUpdateSpaceMutation } from "@/lib/redux/api";
import { solidColors, parseThemeConfig } from "@/lib/space-themes";
import type { RouteType } from "@/lib/route-utils";
import { ParticleLogoCanvas } from "./particle-logo-canvas";
import { Mains } from "@/components/ui/icons";
import { SpaceThemePicker } from "./space-theme-picker";
import ClaudeSettings from "@/features/settings/components/claude";
import CodexSettings from "@/features/settings/components/codex";
import CopilotSettings from "@/features/settings/components/copilot";
import CursorSettings from "@/features/settings/components/cursor";

function RouteProviderSettings({ routeType }: { routeType: RouteType }) {
  switch (routeType) {
    case "claude":
      return <ClaudeSettings />;
    case "codex":
      return <CodexSettings />;
    case "copilot":
      return <CopilotSettings />;
    case "cursor":
      return <CursorSettings />;
    default:
      return null;
  }
}

export type WorkspaceEmptyPresentation = "logo" | "headline";

interface WorkspaceEmptyStateProps {
  workspace: Workspace | null;
  /** `headline` matches a centered empty prompt (title + input below). Default keeps the animated logo. */
  presentation?: WorkspaceEmptyPresentation;
  isCustomizing?: boolean;
  onToggleCustomize?: () => void;
}

export function WorkspaceEmptyState({
  presentation = "logo",
  isCustomizing = false,
  onToggleCustomize,
}: WorkspaceEmptyStateProps) {
  const routeType = useRouteType();
  const { activeSpace } = useActiveSpace();
  const [updateSpace] = useUpdateSpaceMutation();

  const { colorIndex } = parseThemeConfig(activeSpace?.themeConfig || null);

  const [trackedSpaceId, setTrackedSpaceId] = useState<string | undefined>(
    activeSpace?.id,
  );

  if (activeSpace?.id !== trackedSpaceId) {
    setTrackedSpaceId(activeSpace?.id);
  }

  const handleSelectTheme = (index: number) => {
    if (!activeSpace) return;
    const pair = solidColors[index] || solidColors[0];
    const themeConfig = JSON.stringify({
      lightBackground: pair.light.value,
      darkBackground: pair.dark.value,
    });
    updateSpace({ id: activeSpace.id, payload: { themeConfig } });
  };

  if (presentation === "headline") {

    return (
      <div className="flex flex-col items-center py-2 text-center shrink-0 w-full max-w-200">
        <button
          type="button"
          onClick={onToggleCustomize}
          className="appearance-none bg-transparent border-0 p-0 cursor-pointer focus:outline-none"
          aria-label={
            isCustomizing ? "Hide space customizer" : "Customize space"
          }
          aria-pressed={isCustomizing}
        >
          <Mains
            className="h-16 w-auto shrink-0 text-primary-200 dark:text-primary-800 hover:text-primary-600 dark:hover:text-primary-300 hover:scale-105 transition-all duration-300"
            aria-hidden
          />
        </button>

        <div
          className="grid w-full transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0.24,1)]"
          style={{
            gridTemplateRows: isCustomizing ? "0fr" : "1fr",
            opacity: isCustomizing ? 0 : 1,
          }}
        >
          <div className="overflow-hidden" />
        </div>

        <div
          className="grid w-full transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.32,0.72,0.24,1)]"
          style={{
            gridTemplateRows: isCustomizing ? "1fr" : "0fr",
          }}
        >
          <div className="overflow-hidden">
            {activeSpace ? (
              <div
                className={`flex flex-col items-stretch py-4 text-left transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.32,0.72,0.24,1)] ${
                  isCustomizing
                    ? "opacity-100 translate-y-0 blur-0 delay-100"
                    : "opacity-0 -translate-y-2 blur-sm"
                }`}
              >
                <div className="flex justify-center pb-8">
                  <SpaceThemePicker
                    selectedColorIndex={colorIndex}
                    onSelectColor={handleSelectTheme}
                  />
                </div>

                <RouteProviderSettings routeType={routeType} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

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
