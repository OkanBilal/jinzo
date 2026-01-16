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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 dark:text-primary-400 " />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
            className="w-full h-9 bg-primary-950/2 dark:bg-primary/4 border-none 
                        rounded-xl pl-10 pr-10 text-sm text-primary-900 dark:text-primary-100 
                        placeholder:text-primary-950/30 dark:placeholder:text-primary/35 
                        transition-all duration-200 focus:outline-none focus:bg-primary-950/4 dark:focus:bg-primary/8 "
          />
          <button
            onClick={onClear}
            className="absolute cursor-pointer right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-primary-100 dark:hover:bg-primary-400/20 rounded-md transition-colors"
          >
            <Close className="w-3 h-3 text-primary-600 dark:text-primary-400" />
          </button>
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="h-9 w-9 cursor-pointer flex items-center justify-center hover:bg-primary-950/5 dark:hover:bg-primary/10 rounded-xl transition-colors"
        >
          <Search className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </button>
      )}
    </div>
  );
}
