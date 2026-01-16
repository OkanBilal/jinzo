import { useState } from "react";
import { Caption } from "@/components/ui/text";
import { ArrowUp } from "@/components/ui/icons";
import WritingPostItem from "./writing-post-item";

interface WritingPostsListProps {
  posts: { url: string, title: string; description: string }[]; 
  isLoading: boolean;
}

export default function WritingPostsList({
  posts,
  isLoading,
}: WritingPostsListProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Caption className="text-primary-400 dark:text-primary-500">
          Loading...
        </Caption>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Caption className="text-primary-400 dark:text-white font-semibold">
          No posts yet
        </Caption>
      </div>
    );
  }

  return (
    <div className="pb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-2 py-2 mb-2 rounded-lg transition-colors"
      >
        <Caption className="text-primary-600 dark:text-primary-400 font-medium">
          Posts
        </Caption>
        <ArrowUp
          className={`w-4 h-4 text-primary-600 dark:text-primary-400 transition-transform duration-150 ease-in-out ${
            isExpanded ? "rotate-180" : "rotate-90"
          }`}
        />
      </button>

      {isExpanded && (
        <div className="space-y-0.5">
          {posts.map((post, index) => (
            <div
              key={post.url}
              style={{
                animation: `slideIn 0.15s ease-out ${index * 0.05}s both`,
              }}
            >
              <WritingPostItem
                title={post.title}
                description={post.description}
              />
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
