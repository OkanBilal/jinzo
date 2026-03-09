import { Asana, Gitlab, Jira, Trello } from "@/components/ui/icons";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";

interface ProviderIconProps {
  provider: string;
  className?: string;
}

export function ProviderIcon({ provider, className = "w-4 h-4 shrink-0" }: ProviderIconProps) {
  switch (provider) {
    case "github":
      return <Github className={className} />;
    case "linear":
      return <Linear className={className} />;
    case "jira":
      return <Jira className={className} />;
    case "asana":
      return <Asana className="h-5.5 w-6 scale-60 shrink-0" />;
    case "gitlab":
      return <Gitlab className={className} />;
    case "trello":
      return <Trello className={className} />;
    default:
      return (
        <svg className={className} viewBox="0 0 16 16" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9 0a1 1 0 11-2 0 1 1 0 012 0z"
          />
        </svg>
      );
  }
}
