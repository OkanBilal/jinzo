import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { Search, Close } from "@/components/ui/icons";

interface SearchBarProps {
  isExpanded: boolean;
  searchQuery: string;
  onToggle: () => void;
  onSearchChange: (value: string) => void;
  onClear: () => void;
}

export default function SearchBar({
  isExpanded,
  searchQuery,
  onToggle,
  onSearchChange,
  onClear,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (isExpanded) {
      inputRef.current?.focus();
    }
  }, [isExpanded]);

  return (
    <div
      className={`relative transition-all duration-200 ease-in-out h-9 flex items-center ${
        isExpanded ? "flex-1" : "w-auto"
      }`}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {isExpanded ? (
        <div className="relative animate-in fade-in duration-200 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-900 dark:text-primary-200 " />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 bg-primary-950/5 dark:bg-primary/5 border-none
                        rounded-xl pl-9 pr-10 text-sm text-primary-900 dark:text-primary/80
                        placeholder:text-primary-900 dark:placeholder:text-primary-200
                        transition-all duration-200 focus:outline-none focus:bg-primary/30 dark:focus:bg-primary/10 "
          />
          <Button
            tooltip="Clear search"
            onClick={onClear}
            className="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-primary/20 dark:hover:bg-primary/10 rounded-md transition-all duration-200"
          >
            <Close className="w-3.5 h-3.5 text-primary-900 dark:text-primary-200" />
          </Button>
        </div>
      ) : (
        <Button
          onClick={onToggle}
          tooltip="Search item"
          tooltipPosition="top"
          className="p-2 cursor-pointer duration-200 flex items-center justify-center hover:bg-primary/20 dark:hover:bg-primary/10 rounded-xl transition-all"
        >
          <Search className="w-4 h-4 text-primary-900 dark:text-primary-200" />
        </Button>
      )}
    </div>
  );
}
