import { Body, Caption, Muted } from "@/components/ui/text";

interface PostItemProps {
  title: string;
  description: string | null;
  // date: string;
}

export default function PostItem({
  title,
  description,
  // date,
}: PostItemProps) {
  return (
    <div className="px-3 py-2.5">
      <Body className="font-medium text-primary-900 dark:text-primary-100 line-clamp-2 leading-snug">
        {title}
      </Body>
      {description && (
        <Muted className="mt-1 line-clamp-2 text-xs leading-relaxed">
          {description}
        </Muted>
      )}

    </div>
  );
}
