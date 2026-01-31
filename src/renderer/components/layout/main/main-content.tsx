import type { ReactNode } from "react";

interface MainContentProps {
  children: ReactNode;
  marginLeft: string;
  marginRight: string;
}

export function MainContent({
  children,
  marginLeft,
  marginRight,
}: MainContentProps) {
  return (
    <main
      className={`flex-1 overflow-hidden transition-all duration-300 ease-out m-2`}
      style={{
        marginLeft,
        marginRight,
        transition: "margin 300ms ease-out",
      }}
    >
      <div
        className={`h-full bg-primary dark:bg-primary-950 overflow-auto rounded-2xl`}
      >
        {children}
      </div>
    </main>
  );
}
