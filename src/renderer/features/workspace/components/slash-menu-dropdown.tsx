import { RefObject, useMemo } from "react";
import { Button } from "@/components/ui/button";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import { useClickOutside } from "@/hooks/use-click-outside";
import type { CommandInfo, SkillInfo } from "@/lib/redux/api/providersApi";
import { Skill } from "../../../components/ui/icons";

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
  isLoadingCommands?: boolean;
  isLoadingSkills?: boolean;
}



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
  isLoadingCommands = false,
  isLoadingSkills = false,
}: SlashMenuDropdownProps) {

  useClickOutside(dropdownRef, () => {
    if (isOpen) onClose();
  });

  // Filter and combine commands and skills
  const { filteredCommands, filteredSkills, hasResults } = useMemo(() => {
    const lowerFilter = filterText.toLowerCase();

    // Filter commands (only user-facing)
    const userFacingCommands = commands.filter(
      (cmd) => cmd.userFacing !== false,
    );
    const matchedCommands = filterText
      ? userFacingCommands.filter((cmd) => {
          const nameMatch = cmd.name.toLowerCase().includes(lowerFilter);
          const descMatch = cmd.description
            ?.toLowerCase()
            .includes(lowerFilter);
          return nameMatch || descMatch;
        })
      : userFacingCommands;

    // Filter skills (only user-invokable)
    const userInvokableSkills = skills.filter(
      (skill) => skill.userInvokable !== false,
    );
    const matchedSkills = filterText
      ? userInvokableSkills.filter((skill) => {
          const nameMatch = skill.name.toLowerCase().includes(lowerFilter);
          const descMatch = skill.description
            ?.toLowerCase()
            .includes(lowerFilter);
          return nameMatch || descMatch;
        })
      : userInvokableSkills;

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
        <div className="max-h-80 max-w-100 overflow-auto noscrollbar">
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
                  <div
                    className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-primary-400 dark:text-primary-500"
                  >
                    <Skill className="size-3.5" />{" "}
                    <span className="text-sm font-medium ">Skills</span>
                  </div>
                  {filteredSkills.map((skill) => (
                    <Button
                      key={`skill-${skill.name}`}
                      type="button"
                      onClick={() => {
                        onSelectSkill(skill);
                        onClose();
                      }}
                      className="w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-100"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium flex items-center gap-1.5">
                          <span className="text-s">/{skill.name}</span>
                          <div className="ml-auto gap-2 flex items-center">
                            {skill.argumentHint && (
                              <span
                                className="font-normal text-xs text-primary-500 dark:text-primary-400"
                              >
                                {skill.argumentHint}
                              </span>
                            )}
                            {skill.source && (
                              <span
                                className="text-t px-1.5 py-0.5 rounded-full bg-primary-200/50 dark:bg-primary-700/50 text-primary-600 dark:text-primary-300"
                              >
                                {getSourceLabel(skill.source)}
                              </span>
                            )}
                          </div>
                        </div>
                        {skill.description && (
                          <div
                            className="text-xs line-clamp-2 text-primary-500 dark:text-primary-400"
                          >
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
                <div className="mx-3 my-1 border-t border-primary-200 dark:border-primary-700" />
              )}

              {/* Commands Section */}
              {filteredCommands.length > 0 && (
                <>
                  <div
                    className="px-3 pt-2 pb-1 text-sm font-medium text-primary-400 dark:text-primary-500"
                  >
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
                      className="w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors last:rounded-b-xl hover:bg-primary-200/30 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-100"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium flex items-center gap-1.5">
                          <span className="text-s">/{cmd.name}</span>
                        </div>
                        {cmd.description && (
                          <div
                            className="text-xs line-clamp-2 text-primary-500 dark:text-primary-400"
                          >
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
