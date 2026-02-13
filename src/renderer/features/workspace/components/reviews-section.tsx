import { useDispatch } from "react-redux";
import { useGetReviewsByWorkspaceQuery } from "@/lib/redux/api";
import { openNoteTab } from "@/lib/redux/slices/workspaceSlice";
import { Document, Notes, PullRequest } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

interface ReviewsSectionProps {
  workspaceId: string;
}

const statusDot: Record<string, string> = {
  open: "bg-blue-500",
  in_review: "bg-amber-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
};

const statusLabel: Record<string, string> = {
  open: "Open",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
};

function relativeTime(ts: number): string {
  const now = Date.now();
  const date = typeof ts === "number" && ts < 1e12 ? ts * 1000 : ts;
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ReviewsSection({ workspaceId }: ReviewsSectionProps) {
  const dispatch = useDispatch();
  const { data: reviews = [], isLoading } = useGetReviewsByWorkspaceQuery({
    workspaceId,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs text-primary-400">Loading...</span>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <span className="text-xs text-primary-400 dark:text-primary-500 text-center">
          No reviews yet
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto noscrollbar px-3 py-2 space-y-1">
      {reviews.map((review, index) => (
        <div
          key={index}
          className="flex justify-between group dark:hover:bg-primary/5 px-1 hover:bg-primary-100/60 rounded-xl animate-slide-in"
          style={{ animationDelay: `${index * 0.02}s` }}
        >
          <button
            onClick={() =>
              dispatch(
                openNoteTab({
                  id: review.id,
                  title: review.title,
                  status: review.status,
                }),
              )
            }
            className=" flex items-center px-1 gap-3 py-2.5 
               transition-colors cursor-pointer
             "
          >
            <Document className="size-4.5 text-primary-200 " />

            <div className="flex flex-col items-start gap-0.5 ">
              <span className="text-[13px] font-semibold text-primary-800 dark:text-primary-200 truncate ">
                {review.title}
              </span>
              <span className="text-[10px] text-primary-400 dark:text-primary-300 ">
                {relativeTime(review.updatedAt)}
              </span>
            </div>
          </button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Add PR function
            }}
          >
            <span className="text-xs dark:text-primary-200 text-primary-700 pr-1 hover:dark:text-primary hover:text-primary-950">
              Create PR
            </span>
          </Button>
        </div>
      ))}
    </div>
  );
}
