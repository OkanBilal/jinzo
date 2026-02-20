import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { markdownComponents } from "@/features/chat/components/markdown-components";
import { useGetReviewByIdQuery } from "@/lib/redux/api";
import { Heading2 } from "@/components/ui/text";

interface NoteTabContentProps {
  reviewId: string;
}

// TODO: 
const statusConfig: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  open: {
    label: "Open",
    dotClass: "bg-blue-500",
    badgeClass: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  },
  in_review: {
    label: "In Review",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  },
  approved: {
    label: "Approved",
    dotClass: "bg-green-500",
    badgeClass: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  },
  rejected: {
    label: "Rejected",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  },
};

export function NoteTabContent({ reviewId }: NoteTabContentProps) {
  const { data: review, isLoading } = useGetReviewByIdQuery(reviewId);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-sm text-primary-400">Loading...</span>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-sm text-primary-400">Review not found</span>
      </div>
    );
  }

  const config = statusConfig[review.status] ?? statusConfig.open;
  const updatedAt = review.updatedAt
    ? new Date(typeof review.updatedAt === "number" ? review.updatedAt * 1000 : review.updatedAt)
    : null;

  return (
    <div className="h-full overflow-y-auto noscrollbar">
      <div className="max-w-210 mx-auto pt-12 pb-24 px-6 space-y-6">
        <div className="space-y-3">
          <Heading2 className="text-xl font-semibold text-primary-900 dark:text-primary-100">
            {review.title}
          </Heading2>

          <div className="flex items-center gap-3 flex-wrap">
            {/* <span
              className={`inline-flex capitalize items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.badgeClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
              {config.label}
            </span> */}
            {updatedAt && (
              <span className="text-xs text-primary-400 dark:text-primary-500">
                Created in {updatedAt.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {review.summary ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
              >
                {review.summary}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-primary-400 dark:text-primary-500 italic">
              No summary provided.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
