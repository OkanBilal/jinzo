import { Caption, Body } from "@/components/ui/text";

interface UserProfileProps {
  avatarUrl?: string;
  displayName?: string;
  isVisible: boolean;
}

const getInitials = (name: string) => {
  if (!name) return "j";
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
      className={`flex items-center gap-3 transition-all duration-300 ease-in-out ${
        isVisible
          ? "opacity-100 flex-1 scale-100"
          : "opacity-0 w-0 scale-95 pointer-events-none"
      }`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName || "User"}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-primary-200 dark:bg-primary-700 flex items-center justify-center">
          <Caption className="text-primary-900 dark:text-primary-300 font-semibold">
            {getInitials(displayName || "")}
          </Caption>
        </div>
      )}
      <Body className="font-medium text-primary-900 dark:text-primary-100 truncate whitespace-nowrap">
        {displayName || "Okan Balcı"}
      </Body>
    </div>
  );
}
