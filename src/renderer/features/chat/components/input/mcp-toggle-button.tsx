import McpIcon from "../../../../components/ui/icons/mcp";

interface McpToggleButtonProps {
  enabled: boolean;
  onToggle: () => void;
}

export default function McpToggleButton({
  enabled,
  onToggle,
}: McpToggleButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`p-1.5 cursor-pointer duration-200 group relative hover:bg-primary-200 dark:hover:bg-primary-800 rounded-full transition-colors ${
        enabled
          ? "text-yellow-500  "
          : " text-primary-500 dark:text-primary-400"
      }`}
      aria-label={enabled ? "Disable MCP mode" : "Enable MCP mode"}
      title={
        enabled ? "MCP mode enabled (tool calling)" : "MCP mode disabled (RAG)"
      }
    >
      <McpIcon className="w-4.5 h-4.5" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-primary-900 dark:bg-primary-100 text-primary-50 dark:text-primary-900 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {enabled ? "MCP Mode (Tools)" : "RAG Mode (Semantic)"}
      </div>
    </button>
  );
}
