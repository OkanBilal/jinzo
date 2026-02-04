import { RefObject, useMemo } from "react";
import { Button } from "@/components/ui/button";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import type { InputVariant } from "./send-button";
import type { CommandInfo } from "@/lib/redux/api/providersApi";

interface SlashCommandDropdownProps {
  commands: CommandInfo[];
  isOpen: boolean;
  onSelect: (command: CommandInfo) => void;
  onClose: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  filterText?: string;
  variant?: InputVariant;
  isLoading?: boolean;
}

const variantStyles = {
  default: {
    selected:
      "bg-primary-200/60 dark:bg-primary-800/50 text-primary-900 dark:text-primary-100",
    item: "hover:bg-primary-200/30 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-100",
    description: "text-primary-500 dark:text-primary-400",
  },
  copilot: {
    selected:
      "bg-copilot-lightblue/60 dark:bg-copilot-lightblue/8 text-copilot-blue dark:text-copilot-lightblue",
    item: "hover:bg-copilot-lightblue/50 dark:hover:bg-copilot-lightblue/6 text-copilot-blue dark:text-copilot-lightblue",
    description: "text-copilot-blue/60 dark:text-copilot-lightblue/60",
  },
  claude: {
    selected:
      "bg-claude-light/60 dark:bg-claude-light/8 text-claude-dark dark:text-claude-light",
    item: "hover:bg-claude-light/50 dark:hover:bg-claude-light/6 text-claude-dark dark:text-claude-light",
    description: "text-claude-dark/60 dark:text-claude-light/60",
  },
};

export function SlashCommandDropdown({
  commands,
  isOpen,
  onSelect,
  onClose,
  dropdownRef,
  filterText = "",
  variant = "default",
  isLoading = false,
}: SlashCommandDropdownProps) {
  const styles = variantStyles[variant];

  // Filter commands based on the text after the slash
  const filteredCommands = useMemo(() => {
    // Only show user-facing commands
    const userFacingCommands = commands.filter((cmd) => cmd.userFacing !== false);

    if (!filterText) {
      return userFacingCommands;
    }

    const lowerFilter = filterText.toLowerCase();
    return userFacingCommands.filter((cmd) => {
      const nameMatch = cmd.name.toLowerCase().includes(lowerFilter);
      const descMatch = cmd.description?.toLowerCase().includes(lowerFilter);
      return nameMatch || descMatch;
    });
  }, [commands, filterText]);

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className="">
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-52"
        useFixedBackground={true}
      >
        <div className="max-h-64 max-w-120 overflow-auto noscrollbar">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              Loading commands...
            </div>
          ) : filteredCommands.length === 0 ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              No matching commands
            </div>
          ) : (
            filteredCommands.map((cmd) => (
              <Button
                key={cmd.name}
                type="button"
                onClick={() => {
                  onSelect(cmd);
                  onClose();
                }}
                className={`w-full  text-left px-4 py-2.5 cursor-pointer text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${styles.item}`}
              >
                <div className="flex  flex-col gap-0.5">
                  <div className="font-medium flex items-center gap-1.5">
                    <span>/{cmd.name}</span>
                    {cmd.argumentHint && (
                      <span className={`font-normal text-xs ${styles.description}`}>
                        {cmd.argumentHint}
                      </span>
                    )}
                  </div>
                  {cmd.description && (
                    <div className={`text-xs ${styles.description}`}>
                      {cmd.description}
                    </div>
                  )}
                </div>
              </Button>
            ))
          )}
        </div>
      </DropdownWrapper>
    </div>
  );
}
