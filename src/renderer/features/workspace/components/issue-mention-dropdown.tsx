import { RefObject, useMemo } from "react";
import { Button, DropdownWrapper } from "@/components/ui";
import { useClickOutside } from "@/hooks/use-click-outside";
import type { IssueWithEntity } from "@/lib/redux/api/entitiesApi";
import { useGetIssuesByProjectQuery } from "@/lib/redux/api";
import { ProviderIcon } from "./provider-icon";

interface IssueMentionDropdownProps {
  isOpen: boolean;
  filterText: string;
  projectId?: string;
  onSelectIssue: (issue: IssueWithEntity) => void;
  onClose: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
}

export function IssueMentionDropdown({
  isOpen,
  filterText,
  projectId,
  onSelectIssue,
  onClose,
  dropdownRef,
}: IssueMentionDropdownProps) {

  useClickOutside(dropdownRef, () => {
    if (isOpen) onClose();
  });

  const { data: issues = [], isLoading } = useGetIssuesByProjectQuery(
    projectId ?? "",
    { skip: !isOpen || !projectId },
  );

  const filtered = useMemo(() => {
    if (!filterText) return issues;
    const lower = filterText.toLowerCase();
    return issues.filter((item) => {
      const num = item.issue.number != null ? String(item.issue.number) : "";
      return (
        item.entity.title.toLowerCase().includes(lower) ||
        num.includes(lower)
      );
    });
  }, [issues, filterText]);

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef}>
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-80"
        useFixedBackground={true}
      >
        <div className="max-h-80 max-w-110 overflow-auto noscrollbar">
          <div className="px-3 pt-2 pb-1 text-xs font-medium text-primary-400 dark:text-primary-500">
            Issues
          </div>
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              {projectId ? "No matching issues" : "No project linked"}
            </div>
          ) : (
            filtered.map((item) => (
              <Button
                key={item.issue.entityId}
                type="button"
                onClick={() => onSelectIssue(item)}
                className="w-full text-left px-3 py-2 cursor-pointer text-sm transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-100 first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex items-center gap-2">
                  <ProviderIcon provider={item.issue.provider} className="w-3.5 h-3.5 shrink-0" fallback="text" />
                  {item.issue.number != null && (
                    <span className="text-xs shrink-0 text-primary-500 dark:text-primary-400">
                      #{item.issue.number}
                    </span>
                  )}
                  <span className="truncate">{item.entity.title}</span>
                </div>
              </Button>
            ))
          )}
        </div>
      </DropdownWrapper>
    </div>
  );
}
