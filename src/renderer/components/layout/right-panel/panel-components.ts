import { ConfigContent } from "@/features/chat/components/config-content";
import { JournalContent } from "@/features/journal/components/journal-content";
import { WorkspaceSidebar } from "@/features/workspace/components/workspace-sidebar";

export const PANEL_COMPONENTS: Record<string, React.ComponentType> = {
  config: ConfigContent,
  journal: JournalContent,
  workspace: WorkspaceSidebar,
  claude: WorkspaceSidebar,
};

export const DEFAULT_PANEL_COMPONENT = ConfigContent;
