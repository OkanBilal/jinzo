import { Button } from "@/components/ui/button";
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
  return (
    <div
      className={`relative transition-all duration-200 ease-in-out h-9 flex items-center ${
        isExpanded ? "flex-1" : "w-auto"
      }`}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {isExpanded ? (
        <div className="relative animate-in fade-in duration-200 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-900 dark:text-primary-400 " />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
            className="w-full h-9 bg-primary-950/2 dark:bg-primary/4 border-none  
                        rounded-xl pl-10 pr-10 text-sm text-primary-900 dark:text-primary-100 
                        placeholder:text-primary-900/90 dark:placeholder:text-primary/35 
                        transition-all duration-200 focus:outline-none focus:bg-primary-950/8 dark:focus:bg-primary/8 "
          />
          <Button
            tooltip="Clear search"
            onClick={onClear}
            className="absolute cursor-pointer hover:scale-[1.02] active:scale-[0.98] right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-primary/20 dark:hover:bg-primary/10 rounded-md transition-all duration-200"
          >
            <Close className="w-3 h-3 text-primary-900 dark:text-primary-400" />
          </Button>
        </div>
      ) : (
        <Button
          onClick={onToggle}
          tooltip="Search item"
          tooltipPosition="top"
          className="h-9 w-9 cursor-pointer hover:scale-[1.02] active:scale-[0.98] duration-200 flex items-center justify-center hover:bg-primary/20 dark:hover:bg-primary/10 rounded-xl transition-all"
        >
          <Search className="w-4 h-4 text-primary-900 dark:text-primary-400" />
        </Button>
      )}
    </div>
  );
}
