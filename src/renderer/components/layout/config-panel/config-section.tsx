import { Body } from "@/components/ui/text";

interface ConfigSectionProps {
  title: string;
  children: React.ReactNode;
}

export function ConfigSection({ title, children }: ConfigSectionProps) {
  return (
    <div className="p-1 ">
      <Body className="font-semibold mb-2 text-primary-800 dark:text-primary-200">
        {title}
      </Body>
      {children}
    </div>
  );
}
