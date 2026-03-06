import { RefObject, useMemo } from "react";
import { Button, DropdownWrapper } from "@/components/ui";
import { useClickOutside } from "@/hooks/use-click-outside";
import type { IssueWithEntity } from "@/lib/redux/api/entitiesApi";
import { useGetIssuesByProjectQuery } from "@/lib/redux/api";
import { Asana, Gitlab, Jira } from "@/components/ui/icons";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";

function ProviderIcon({ provider }: { provider: string }) {
  switch (provider) {
    case "github":
      return <Github className="w-3.5 h-3.5 shrink-0" />;
    case "linear":
      return <Linear className="w-3.5 h-3.5 shrink-0" />;
    case "jira":
      return <Jira className="w-3.5 h-3.5 shrink-0" />;
    case "asana":
      return <Asana className="h-5.5 w-6 scale-60 shrink-0" />;
    case "gitlab":
      return <Gitlab className="w-3.5 h-3.5 shrink-0" />;
    default:
      return (
        <span className="text-xs font-medium uppercase shrink-0">
          {provider.slice(0, 2)}
        </span>
      );
  }
}

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
                className="w-full text-left px-3 py-2 cursor-pointer text-sm transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-100 first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex items-center gap-2">
                  <ProviderIcon provider={item.issue.provider} />
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
