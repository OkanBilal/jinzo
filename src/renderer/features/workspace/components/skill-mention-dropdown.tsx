import { RefObject, useCallback, useMemo, useState } from "react";
import { Button, DropdownWrapper } from "@/components/ui";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useLocalImageUrl } from "@/hooks/use-local-image-url";
import type { SkillInfo } from "@/lib/redux/api/providersApi";
import { Sparkles } from "@/components/ui/icons";
import { useDropdownKeyboardNavigation } from "@/features/workspace/hooks/use-dropdown-keyboard-navigation";

interface SkillMentionDropdownProps {
  isOpen: boolean;
  filterText: string;
  skills: SkillInfo[];
  isLoading?: boolean;
  onSelectSkill: (skill: SkillInfo) => void;
  onClose: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
}

function getScopeLabel(scope?: string): string {
  switch (scope) {
    case "user":
      return "User";
    case "project":
    case "repo":
      return "Project";
    case "system":
      return "System";
    case "plugin":
      return "Plugin";
    default:
      return "";
  }
}

function SkillIcon({ skill }: { skill: SkillInfo }) {
  const [failed, setFailed] = useState(false);
  const iconPath = skill.iconLarge || skill.iconSmall;
  const resolved = useLocalImageUrl(iconPath);
  if (iconPath && resolved && !failed) {
    return (
      <img
        src={resolved}
        alt=""
        className="size-5 rounded shrink-0 object-contain"
        style={skill.brandColor ? { backgroundColor: skill.brandColor } : undefined}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="size-5 rounded shrink-0 flex items-center justify-center bg-primary-200/50 dark:bg-primary-700/50 text-primary-600 dark:text-primary-300"
      style={skill.brandColor ? { backgroundColor: skill.brandColor, color: "#fff" } : undefined}
    >
      <Sparkles className="size-3" />
    </div>
  );
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
      const displayMatch = s.displayName?.toLowerCase().includes(lower);
      const descMatch =
        s.shortDescription?.toLowerCase().includes(lower) ||
        s.description?.toLowerCase().includes(lower);
      return nameMatch || displayMatch || descMatch;
    });
  }, [skills, filterText]);

  const selectSkillAt = useCallback(
    (index: number) => {
      const skill = filtered[index];
      if (!skill) return;
      onSelectSkill(skill);
      onClose();
    },
    [filtered, onClose, onSelectSkill],
  );

  const { activeIndex, setActiveIndex } = useDropdownKeyboardNavigation({
    isOpen,
    itemCount: filtered.length,
    disabled: isLoading,
    resetKey: filterText,
    onSelectActive: selectSkillAt,
  });

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef}>
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-64"
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
            filtered.map((skill, index) => {
              const title = skill.displayName || skill.name;
              const desc = skill.shortDescription || skill.description;
              const scopeLabel = getScopeLabel(skill.scope || skill.source);
              return (
                <Button
                  key={`skill-${skill.name}-${skill.path ?? ""}`}
                  type="button"
                  data-dropdown-active={index === activeIndex ? "true" : undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    onSelectSkill(skill);
                    onClose();
                  }}
                  className={`w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-100 last:rounded-b-xl ${
                    index === activeIndex ? "bg-primary-200/30 dark:bg-primary-800" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <SkillIcon skill={skill} />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="font-medium flex items-center gap-1.5">
                        <span className="truncate text-s">{title}</span>
                        <div className="ml-auto gap-2 flex items-center shrink-0">
                          {skill.argumentHint && (
                            <span className="font-normal text-xs text-primary-500 dark:text-primary-400">
                              {skill.argumentHint}
                            </span>
                          )}
                          {scopeLabel && (
                            <span className="text-t px-1.5 py-0.25 rounded-full bg-primary-200/50 dark:bg-primary-700/50 text-primary-600 dark:text-primary-300">
                              {scopeLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      {desc && (
                        <div className="text-xs line-clamp-2 text-primary-500 dark:text-primary-400">
                          {desc}
                        </div>
                      )}
                    </div>
                  </div>
                </Button>
              );
            })
          )}
        </div>
      </DropdownWrapper>
    </div>
  );
}
