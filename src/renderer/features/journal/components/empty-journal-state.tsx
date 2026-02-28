import { Textitalic } from "@/components/ui/icons/space";

export function EmptyJournalState() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center px-6">
      <Textitalic className="w-12 h-12 text-primary-700 dark:text-primary-300 mb-4" />
      <h2 className="text-xl font-semibold text-primary-800 dark:text-primary-200 mb-2">
        Welcome to Journal
      </h2>
      <p className="text-primary-500 dark:text-primary-400 max-w-md">
        Select an existing post from the sidebar or <br /> create a new one{" "}
        <span className="font-sans">(⌘ N)</span> to start writing.
      </p>
    </div>
  );
}
