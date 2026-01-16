import { Link } from "react-router-dom";
import { Close } from "@/components/ui/icons";
import { Body, BodyMedium, Caption, Timestamp } from "@/components/ui/text";
import { ChatSession } from "@/lib/redux/api";
import { formatDate } from "@/lib/format-date";

interface ChatSessionItemProps {
  session: ChatSession;
  isActive: boolean;
  onDelete: (session: ChatSession, e: React.MouseEvent) => void;
}

export default function ChatSessionItem({
  session,
  isActive,
  onDelete,
}: ChatSessionItemProps) {
  const title = session.title || session.initialQuery || "Untitled Chat";

  return (
    <div className="relative group">
      <Link
        to={`/chat/${session.id}`}
        className={`block pl-3 pr-2 py-2 rounded-xl transition-all duration-200 ease-out active:scale-[0.98] ${
          isActive
            ? "bg-primary-950/5 dark:bg-primary/5"
            : "bg-transparent hover:bg-primary-950/3 dark:hover:bg-primary/5"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Body
              className={`font-normal line-clamp-1  ${
                isActive
                  ? "text-primary-900 dark:text-primary"
                  : "text-primary-800 dark:text-primary-100"
              }`}
            >
              {title}
            </Body>
            <Timestamp className="">
              {formatDate(new Date(session.createdAt).toISOString())}
            </Timestamp>
          </div>
          <button
            onClick={(e) => onDelete(session, e)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-primary-100 dark:hover:bg-primary-400/20 cursor-pointer rounded-md"
            aria-label="Delete chat"
          >
            <Close className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
          </button>
        </div>
      </Link>
    </div>
  );
}
