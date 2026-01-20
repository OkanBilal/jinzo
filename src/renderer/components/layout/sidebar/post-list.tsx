import { useState, type MouseEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Caption } from "@/components/ui/text";
import { ArrowUp } from "@/components/ui/icons";
import PostItem from "./post-item";

interface Post {
  id: string;
  url: string;
  title: string;
  description: string;
  status?: "draft" | "published";
  updatedAt?: string;
  createdAt?: string;
}

interface PostsListProps {
  posts: Post[];
  isLoading: boolean;
  onDeletePost?: (postId: string, e: MouseEvent) => void;
}

export default function PostsList({
  posts,
  isLoading,
  onDeletePost,
}: PostsListProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

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

  const handlePostClick = (post: Post) => {
    navigate(post.url);
  };

  // Sort posts by createdAt (newest first)
  const sortedPosts = [...posts].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

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
          {sortedPosts.map((post, index) => {
            const isActive = location.pathname === post.url;
            return (
              <div
                key={post.id}
                style={{
                  animation: `slideIn 0.15s ease-out ${index * 0.05}s both`,
                }}
              >
                <PostItem
                  title={post.title}
                  description={post.description}
                  status={post.status}
                  isActive={isActive}
                  onClick={() => handlePostClick(post)}
                  onDelete={onDeletePost ? (e) => onDeletePost(post.id, e) : undefined}
                />
              </div>
            );
          })}
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
