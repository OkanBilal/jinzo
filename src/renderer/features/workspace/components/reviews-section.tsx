import { useDispatch } from "react-redux";
import { useGetReviewsByWorkspaceQuery, useGetAppSettingsQuery } from "@/lib/redux/api";
import { openNoteTab, setPendingGoal } from "@/lib/redux/slices/workspaceSlice";
import { Document, Notes, PullRequest, Sparkles } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Body } from "@/components/ui/text";

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
  const { data: appSettings } = useGetAppSettingsQuery();
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
        <Body className="text-xs font-medium text-primary-800 dark:text-primary-300">
          No reviews yet
        </Body>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 px-3 ">
      {/* Create PR button */}
      <Button
        onClick={() => {
          const instructions = appSettings?.prInstructions;
          dispatch(
            setPendingGoal(
              instructions
                ? instructions + "\n\nCreate a pull request."
                : "Create a pull request.",
            ),
          );
        }}
        className="shrink-0 flex items-center justify-center gap-1.5 mb-2 py-2 px-3 text-xs font-medium rounded-xl bg-primary-100 dark:bg-primary/5 hover:bg-primary-200 dark:hover:bg-primary/10 text-primary-800 dark:text-primary-200 transition-colors"
      >
        <PullRequest className="w-3.5 h-3.5" />
        Create PR
      </Button>

      {/* Reviews list */}
      <div className="flex-1 overflow-y-auto noscrollbar space-y-1">
        {reviews.map((review, index) => (
          <button
            key={review.id}
            onClick={() =>
              dispatch(
                openNoteTab({
                  id: review.id,
                  title: review.title,
                  status: review.status,
                }),
              )
            }
            className="w-full flex items-center px-2 gap-3 py-2.5 dark:hover:bg-primary/5 hover:bg-primary-100/60 rounded-xl transition-colors cursor-pointer animate-slide-in"
            style={{ animationDelay: `${index * 0.02}s` }}
          >
            <Document className="size-4.5 text-primary-200 shrink-0" />

            <div className="flex flex-col items-start gap-0.5 min-w-0">
              <span className="text-[13px] font-semibold text-primary-900 dark:text-primary-200 truncate max-w-full">
                {review.title}
              </span>
              <span className="text-[10px] text-primary-800 dark:text-primary-300">
                {relativeTime(review.updatedAt)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
