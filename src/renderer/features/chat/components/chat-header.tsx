import { AnimatedTitle } from "../../../components/ui/animated-title";

export const ChatHeader = ({ title }: ChatHeaderProps) => {
  return (
    <header className="flex items-center justify-between" role="banner">
      <div className="overflow-hidden">
        <AnimatedTitle
          title={title}
          className="text-lg font-semibold text-primary-900 dark:text-primary-50 mb-1 block"
        />
      </div>
    </header>
  );
};

interface ChatHeaderProps {
  title: string;
}
