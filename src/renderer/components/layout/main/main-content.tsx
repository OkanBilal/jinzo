import type { ReactNode } from "react";

interface MainContentProps {
  children: ReactNode;
  marginLeft: string;
  marginRight: string;
}

export function MainContent({ children, marginLeft, marginRight }: MainContentProps) {
  return (
    <main
      className="flex-1 m-2 overflow-hidden transition-all duration-300 ease-out"
      style={{
        marginLeft,
        marginRight,
        transition: "margin 300ms ease-out",
      }}
    >
      <div className="h-full bg-primary dark:bg-primary-950 rounded-2xl overflow-auto">
        {children}
      </div>
    </main>
  );
}
