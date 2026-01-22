import { Heading3 } from "@/components/ui/text";

export const ChatHeader = ({ title }: ChatHeaderProps) => {
  return (
    <header className="flex items-center justify-between" role="banner">
      <Heading3 className=" text-primary-900 dark:text-primary-50 mb-1 block">
        {title}
      </Heading3>
    </header>
  );
};

interface ChatHeaderProps {
  title: string;
}
