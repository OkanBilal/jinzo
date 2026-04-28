import { RefObject, useMemo } from "react";
import { Button, DropdownWrapper } from "@/components/ui";
import { useClickOutside } from "@/hooks/use-click-outside";
import type { CommandInfo } from "@/lib/redux/api/providersApi";

interface SlashMenuDropdownProps {
  commands: CommandInfo[];
  isOpen: boolean;
  onSelectCommand: (command: CommandInfo) => void;
  onClose: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  filterText?: string;
  isLoadingCommands?: boolean;
}

export function SlashMenuDropdown({
  commands,
  isOpen,
  onSelectCommand,
  onClose,
  dropdownRef,
  filterText = "",
  isLoadingCommands = false,
}: SlashMenuDropdownProps) {
  useClickOutside(dropdownRef, () => {
    if (isOpen) onClose();
  });

  const filteredCommands = useMemo(() => {
    const userFacing = commands.filter((cmd) => cmd.userFacing !== false);
    if (!filterText) return userFacing;
    const lower = filterText.toLowerCase();
    return userFacing.filter((cmd) => {
      const nameMatch = cmd.name.toLowerCase().includes(lower);
      const descMatch = cmd.description?.toLowerCase().includes(lower);
      return nameMatch || descMatch;
    });
  }, [commands, filterText]);

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className="">
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-64"
        useFixedBackground={true}
      >
        <div className="max-h-80 max-w-100 overflow-auto noscrollbar">
          {isLoadingCommands ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              Loading...
            </div>
          ) : filteredCommands.length === 0 ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              No matching commands
            </div>
          ) : (
            <>
              <div className="px-3 pt-2 pb-1 text-sm font-medium text-primary-400 dark:text-primary-500">
                ⌘ Commands
              </div>
              {filteredCommands.map((cmd) => (
                <Button
                  key={`cmd-${cmd.name}`}
                  type="button"
                  onClick={() => {
                    onSelectCommand(cmd);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors last:rounded-b-xl hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-100"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="font-medium flex items-center gap-1.5">
                      <span className="text-s">/{cmd.name}</span>
                    </div>
                    {cmd.description && (
                      <div className="text-xs line-clamp-2 text-primary-500 dark:text-primary-400">
                        {cmd.description}
                      </div>
                    )}
                  </div>
                </Button>
              ))}
            </>
          )}
        </div>
      </DropdownWrapper>
    </div>
  );
}
