import { Caption, Body } from "@/components/ui";
import { proxiedImageSrc } from "@/lib/proxied-image-src";

interface UserProfileProps {
  avatarUrl?: string;
  displayName?: string;
  isVisible: boolean;
}

const getInitials = (name: string) => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function UserProfile({
  avatarUrl,
  displayName,
  isVisible,
}: UserProfileProps) {
  return (
    <div
      className={`flex items-center gap-2 transition-all duration-300 ease-in-out  ${
        isVisible
          ? "opacity-100 flex-1 scale-100"
          : "opacity-0 w-0 scale-95 pointer-events-none"
      }`}
    >
      {avatarUrl ? (
        <img
          src={proxiedImageSrc(avatarUrl) ?? avatarUrl}
          alt={displayName || "Mains"}
          className="w-6 h-6 rounded-full object-cover ml-1"
        />
      ) : (
        <div className="w-6 h-6 rounded-full bg-primary-200/60 dark:bg-primary/5 flex items-center justify-center">
          <Caption className="text-primary-900 dark:text-primary-200 text-xxs font-medium">
            {getInitials(displayName || "")}
          </Caption>
        </div>
      )}
      <Body className="font-medium text-primary-900 dark:text-primary-100 truncate whitespace-nowrap">
        {displayName || "Mains"}
      </Body>
    </div>
  );
}
