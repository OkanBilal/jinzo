import { useState, type MouseEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Caption } from "@/components/ui/text";
import { ArrowUp } from "@/components/ui/icons";
import { useUpdateJournalDraftMutation } from "@/lib/redux/api";
import PostItem from "./post-item";
import { Button } from "@/components/ui/button";

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
  const [updateJournalDraft] = useUpdateJournalDraftMutation();

  const handleRenamePost = async (postId: string, newTitle: string) => {
    try {
      await updateJournalDraft({ id: postId, payload: { title: newTitle } });
    } catch (error) {
      console.error("Failed to rename post:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Caption className="text-primary-800 dark:text-primary-500">
          Loading...
        </Caption>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Caption className="text-primary-800 dark:text-primary-100! font-semibold">
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
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between active:scale-99 transition-all duration-200 bg-transparent hover:bg-primary/10 dark:hover:bg-primary/5 cursor-pointer px-2 py-2 mb-1 rounded-lg "
      >
        <Caption className="text-primary-800 dark:text-primary-300! font-medium ">
          Posts
        </Caption>
        <ArrowUp
          className={`w-4 h-4 text-primary-800 dark:text-primary-300 transition-transform duration-150 ease-in-out ${
            isExpanded ? "rotate-180" : "rotate-90"
          }`}
        />
      </Button>

      {isExpanded && (
        <div className="space-y-1">
          {sortedPosts.map((post, index) => {
            const isActive = location.pathname === post.url;
            return (
              <div
                key={post.id}
                className="animate-slide-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <PostItem
                  title={post.title}
                  description={post.description}
                  status={post.status}
                  isActive={isActive}
                  onClick={() => handlePostClick(post)}
                  onDelete={onDeletePost ? (e) => onDeletePost(post.id, e) : undefined}
                  onRename={(newTitle) => handleRenamePost(post.id, newTitle)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
