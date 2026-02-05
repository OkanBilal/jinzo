import { RefObject, useMemo } from "react";
import { Button } from "@/components/ui/button";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import type { InputVariant } from "./send-button";
import type { SkillInfo } from "@/lib/redux/api/providersApi";

interface SkillsDropdownProps {
  skills: SkillInfo[];
  isOpen: boolean;
  onSelect: (skill: SkillInfo) => void;
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
    badge: "bg-primary-200/50 dark:bg-primary-700/50 text-primary-600 dark:text-primary-300",
  },
  copilot: {
    selected:
      "bg-copilot-lightblue/60 dark:bg-copilot-lightblue/8 text-copilot-blue dark:text-copilot-lightblue",
    item: "hover:bg-copilot-lightblue/50 dark:hover:bg-copilot-lightblue/6 text-copilot-blue dark:text-copilot-lightblue",
    description: "text-copilot-blue/60 dark:text-copilot-lightblue/60",
    badge: "bg-copilot-lightblue/30 dark:bg-copilot-lightblue/10 text-copilot-blue dark:text-copilot-lightblue",
  },
  claude: {
    selected:
      "bg-claude-light/60 dark:bg-claude-light/8 text-claude-dark dark:text-claude-light",
    item: "hover:bg-claude-light/50 dark:hover:bg-claude-light/6 text-claude-dark dark:text-claude-light",
    description: "text-claude-dark/60 dark:text-claude-light/60",
    badge: "bg-claude-light/30 dark:bg-claude-light/10 text-claude-dark dark:text-claude-light",
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

export function SkillsDropdown({
  skills,
  isOpen,
  onSelect,
  onClose,
  dropdownRef,
  filterText = "",
  variant = "default",
  isLoading = false,
}: SkillsDropdownProps) {
  const styles = variantStyles[variant];

  // Filter skills based on the text after the slash
  // Only show user-invocable skills
  const filteredSkills = useMemo(() => {
    const userInvocableSkills = skills.filter(
      (skill) => skill.userInvocable !== false
    );

    if (!filterText) {
      return userInvocableSkills;
    }

    const lowerFilter = filterText.toLowerCase();
    return userInvocableSkills.filter((skill) => {
      const nameMatch = skill.name.toLowerCase().includes(lowerFilter);
      const descMatch = skill.description?.toLowerCase().includes(lowerFilter);
      return nameMatch || descMatch;
    });
  }, [skills, filterText]);

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
              Loading skills...
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              No matching skills
            </div>
          ) : (
            filteredSkills.map((skill) => (
              <Button
                key={skill.name}
                type="button"
                onClick={() => {
                  onSelect(skill);
                  onClose();
                }}
                className={`w-full text-left px-4 py-2.5 cursor-pointer text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${styles.item}`}
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
                    <div className={`text-xs ${styles.description}`}>
                      {skill.description}
                    </div>
                  )}
                  {(skill.forked || skill.model) && (
                    <div className={`text-[10px] flex items-center gap-2 mt-0.5 ${styles.description}`}>
                      {skill.forked && <span>🔀 Forked</span>}
                      {skill.model && <span>🤖 {skill.model}</span>}
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
