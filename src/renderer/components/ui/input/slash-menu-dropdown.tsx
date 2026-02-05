import { RefObject, useMemo } from "react";
import { Button } from "@/components/ui/button";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import type { InputVariant } from "./send-button";
import type { CommandInfo, SkillInfo } from "@/lib/redux/api/providersApi";

// Unified item type for the dropdown
export type SlashMenuItem =
  | { type: "command"; item: CommandInfo }
  | { type: "skill"; item: SkillInfo };

interface SlashMenuDropdownProps {
  commands: CommandInfo[];
  skills: SkillInfo[];
  isOpen: boolean;
  onSelectCommand: (command: CommandInfo) => void;
  onSelectSkill: (skill: SkillInfo) => void;
  onClose: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  filterText?: string;
  variant?: InputVariant;
  isLoadingCommands?: boolean;
  isLoadingSkills?: boolean;
}

const variantStyles = {
  default: {
    item: "hover:bg-primary-200/30 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-100",
    description: "text-primary-500 dark:text-primary-400",
    badge: "bg-primary-200/50 dark:bg-primary-700/50 text-primary-600 dark:text-primary-300",
    sectionHeader: "text-primary-400 dark:text-primary-500",
    divider: "border-primary-200 dark:border-primary-700",
  },
  copilot: {
    item: "hover:bg-copilot-lightblue/50 dark:hover:bg-copilot-lightblue/6 text-copilot-blue dark:text-copilot-lightblue",
    description: "text-copilot-blue/60 dark:text-copilot-lightblue/60",
    badge: "bg-copilot-lightblue/30 dark:bg-copilot-lightblue/10 text-copilot-blue dark:text-copilot-lightblue",
    sectionHeader: "text-copilot-blue/50 dark:text-copilot-lightblue/50",
    divider: "border-copilot-lightblue/20 dark:border-copilot-lightblue/10",
  },
  claude: {
    item: "hover:bg-claude-light/50 dark:hover:bg-claude-light/6 text-claude-dark dark:text-claude-light",
    description: "text-claude-dark/60 dark:text-claude-light/60",
    badge: "bg-claude-light/30 dark:bg-claude-light/10 text-claude-dark dark:text-claude-light",
    sectionHeader: "text-claude-dark/50 dark:text-claude-light/50",
    divider: "border-claude-light/20 dark:border-claude-light/10",
  },
};

function getSourceLabel(source?: string): string {
  switch (source) {
    case "user":
      return "User";
    case "project":
      return "Project";
    case "plugin":
      return "Plugin";
    default:
      return "";
  }
}

export function SlashMenuDropdown({
  commands,
  skills,
  isOpen,
  onSelectCommand,
  onSelectSkill,
  onClose,
  dropdownRef,
  filterText = "",
  variant = "default",
  isLoadingCommands = false,
  isLoadingSkills = false,
}: SlashMenuDropdownProps) {
  const styles = variantStyles[variant];

  // Filter and combine commands and skills
  const { filteredCommands, filteredSkills, hasResults } = useMemo(() => {
    const lowerFilter = filterText.toLowerCase();

    // Filter commands (only user-facing)
    const userFacingCommands = commands.filter((cmd) => cmd.userFacing !== false);
    const matchedCommands = filterText
      ? userFacingCommands.filter((cmd) => {
          const nameMatch = cmd.name.toLowerCase().includes(lowerFilter);
          const descMatch = cmd.description?.toLowerCase().includes(lowerFilter);
          return nameMatch || descMatch;
        })
      : userFacingCommands;

    // Filter skills (only user-invocable)
    const userInvocableSkills = skills.filter((skill) => skill.userInvocable !== false);
    const matchedSkills = filterText
      ? userInvocableSkills.filter((skill) => {
          const nameMatch = skill.name.toLowerCase().includes(lowerFilter);
          const descMatch = skill.description?.toLowerCase().includes(lowerFilter);
          return nameMatch || descMatch;
        })
      : userInvocableSkills;

    return {
      filteredCommands: matchedCommands,
      filteredSkills: matchedSkills,
      hasResults: matchedCommands.length > 0 || matchedSkills.length > 0,
    };
  }, [commands, skills, filterText]);

  const isLoading = isLoadingCommands || isLoadingSkills;

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className="">
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-64"
        useFixedBackground={true}
      >
        <div className="max-h-80 max-w-120 overflow-auto noscrollbar">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              Loading...
            </div>
          ) : !hasResults ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              No matching commands or skills
            </div>
          ) : (
            <>
              {/* Skills Section */}
              {filteredSkills.length > 0 && (
                <>
                  <div className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${styles.sectionHeader}`}>
                    ⚡ Skills
                  </div>
                  {filteredSkills.map((skill) => (
                    <Button
                      key={`skill-${skill.name}`}
                      type="button"
                      onClick={() => {
                        onSelectSkill(skill);
                        onClose();
                      }}
                      className={`w-full text-left px-4 py-2 cursor-pointer text-sm transition-colors ${styles.item}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium flex items-center gap-1.5">
                          <span className="text-amber-500 dark:text-amber-400">⚡</span>
                          <span>/{skill.name}</span>
                          {skill.argumentHint && (
                            <span className={`font-normal text-xs ${styles.description}`}>
                              {skill.argumentHint}
                            </span>
                          )}
                          {skill.source && (
                            <span
                              className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${styles.badge}`}
                            >
                              {getSourceLabel(skill.source)}
                            </span>
                          )}
                        </div>
                        {skill.description && (
                          <div className={`text-xs line-clamp-2 ${styles.description}`}>
                            {skill.description}
                          </div>
                        )}
                      </div>
                    </Button>
                  ))}
                </>
              )}

              {/* Divider between skills and commands */}
              {filteredSkills.length > 0 && filteredCommands.length > 0 && (
                <div className={`mx-3 my-1 border-t ${styles.divider}`} />
              )}

              {/* Commands Section */}
              {filteredCommands.length > 0 && (
                <>
                  <div className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${styles.sectionHeader}`}>
                    📋 Commands
                  </div>
                  {filteredCommands.map((cmd) => (
                    <Button
                      key={`cmd-${cmd.name}`}
                      type="button"
                      onClick={() => {
                        onSelectCommand(cmd);
                        onClose();
                      }}
                      className={`w-full text-left px-4 py-2 cursor-pointer text-sm transition-colors last:rounded-b-xl ${styles.item}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium flex items-center gap-1.5">
                          <span>/{cmd.name}</span>
                          {cmd.argumentHint && (
                            <span className={`font-normal text-xs ${styles.description}`}>
                              {cmd.argumentHint}
                            </span>
                          )}
                        </div>
                        {cmd.description && (
                          <div className={`text-xs line-clamp-2 ${styles.description}`}>
                            {cmd.description}
                          </div>
                        )}
                      </div>
                    </Button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </DropdownWrapper>
    </div>
  );
}
