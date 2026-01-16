import { Link } from "react-router-dom";
import { Close } from "@/components/ui/icons";
import { Timestamp } from "@/components/ui/text";
import { AnimatedTitle } from "@/components/ui/animated-title";
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
        className={`block pl-3 pr-3 py-2 rounded-xl transition-all duration-200 ease-out active:scale-[0.98] ${
          isActive
            ? "bg-primary-950/5 dark:bg-primary/5"
            : "bg-transparent hover:bg-primary-950/3 dark:hover:bg-primary/5"
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="line-clamp-1">
            <AnimatedTitle
              title={title}
              className={`text-sm font-normal ${
                isActive
                  ? "text-primary-900 dark:text-primary"
                  : "text-primary-800 dark:text-primary-100"
              }`}
            />
          </div>
          <Timestamp className="">
            {formatDate(new Date(session.createdAt).toISOString())}
          </Timestamp>
        </div>
      </Link>
      <button
        onClick={(e) => onDelete(session, e)}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-primary-100 dark:hover:bg-primary-400/20 cursor-pointer rounded-md z-10"
        aria-label="Delete chat"
      >
        <Close className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
      </button>
    </div>
  );
}
