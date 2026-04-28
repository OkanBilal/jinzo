import { RefObject, useMemo } from "react";
import { Button, DropdownWrapper } from "@/components/ui";
import { useClickOutside } from "@/hooks/use-click-outside";
import type { SkillInfo } from "@/lib/redux/api/providersApi";
import { Sparkles } from "@/components/ui/icons";

interface SkillMentionDropdownProps {
  isOpen: boolean;
  filterText: string;
  skills: SkillInfo[];
  isLoading?: boolean;
  onSelectSkill: (skill: SkillInfo) => void;
  onClose: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
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

export function SkillMentionDropdown({
  isOpen,
  filterText,
  skills,
  isLoading = false,
  onSelectSkill,
  onClose,
  dropdownRef,
}: SkillMentionDropdownProps) {
  useClickOutside(dropdownRef, () => {
    if (isOpen) onClose();
  });

  const filtered = useMemo(() => {
    const userInvokable = skills.filter((s) => s.userInvokable !== false);
    if (!filterText) return userInvokable;
    const lower = filterText.toLowerCase();
    return userInvokable.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(lower);
      const descMatch = s.description?.toLowerCase().includes(lower);
      return nameMatch || descMatch;
    });
  }, [skills, filterText]);

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef}>
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-64"
        useFixedBackground={true}
      >
        <div className="max-h-80 max-w-100 overflow-auto noscrollbar">
          <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-primary-400 dark:text-primary-500">
            <Sparkles className="size-3.5" />
            <span className="text-sm font-medium">Skills</span>
          </div>
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              No skills available
            </div>
          ) : (
            filtered.map((skill) => (
              <Button
                key={`skill-${skill.name}`}
                type="button"
                onClick={() => {
                  onSelectSkill(skill);
                  onClose();
                }}
                className="w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-100 last:rounded-b-xl"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="font-medium flex items-center gap-1.5">
                    <span className="text-s">${skill.name}</span>
                    <div className="ml-auto gap-2 flex items-center">
                      {skill.argumentHint && (
                        <span className="font-normal text-xs text-primary-500 dark:text-primary-400">
                          {skill.argumentHint}
                        </span>
                      )}
                      {skill.source && (
                        <span className="text-t px-1.5 py-0.5 rounded-full bg-primary-200/50 dark:bg-primary-700/50 text-primary-600 dark:text-primary-300">
                          {getSourceLabel(skill.source)}
                        </span>
                      )}
                    </div>
                  </div>
                  {skill.description && (
                    <div className="text-xs line-clamp-2 text-primary-500 dark:text-primary-400">
                      {skill.description}
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
