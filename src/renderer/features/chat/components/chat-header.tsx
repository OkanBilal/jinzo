import { Heading3 } from "../../../components/ui/text";

export const ChatHeader = ({ title }: ChatHeaderProps) => {
  return (
    <header className="flex items-center justify-between" role="banner">
      <div>
        <Heading3 className="mb-1">{title}</Heading3>
      </div>
    </header>
  );
};

interface ChatHeaderProps {
  title: string;
}
