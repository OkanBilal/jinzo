import { type MouseEvent } from "react";
import { Body, Muted } from "@/components/ui/text";
import { Close } from "@/components/ui/icons";

interface PostItemProps {
  title: string;
  description: string | null;
  status?: "draft" | "published";
  isActive?: boolean;
  onClick?: () => void;
  onDelete?: (e: MouseEvent) => void;
}

export default function PostItem({
  title,
  description,
  status,
  isActive = false,
  onClick,
  onDelete,
}: PostItemProps) {
  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete?.(e);
  };

  return (
    <div
      onClick={onClick}
      className={`group px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "bg-primary-200/60 dark:bg-primary-700/40"
          : "hover:bg-primary-100/50 dark:hover:bg-primary-800/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Body className="font-medium text-primary-900 dark:text-primary-100 line-clamp-1 leading-snug">
              {title}
            </Body>
            {status === "draft" && (
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                Draft
              </span>
            )}
          </div>
          {description && (
            <Muted className="mt-1 line-clamp-2 text-xs leading-relaxed">
              {description}
            </Muted>
          )}
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-primary-200/60 dark:hover:bg-primary-600/40 transition-all"
            aria-label="Delete post"
          >
        <Close className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
          </button>
        )}
      </div>
    </div>
  );
}
