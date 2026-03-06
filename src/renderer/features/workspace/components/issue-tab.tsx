import type { IssueWithEntity } from "@/lib/redux/api";
import { BaseTab } from "./base-tab";
import { ProviderIcon } from "./provider-icon";

export function IssueTab({ issue, isActive, isFirst, onClick, onClose, variant }: {
  issue: IssueWithEntity;
  isActive: boolean;
  isFirst?: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  variant?: "copilot" | "claude";
}) {
  const { issue: iss, entity } = issue;
  const label =
    iss.number != null
      ? `#${iss.number} ${entity.title || ""}`
      : entity.title || "Issue";

  return (
    <BaseTab
      isActive={isActive}
      isFirst={isFirst}
      onClick={onClick}
      onClose={onClose}
      icon={<ProviderIcon provider={iss.provider} />}
      label={label}
      variant={variant}
    />
  );
}
