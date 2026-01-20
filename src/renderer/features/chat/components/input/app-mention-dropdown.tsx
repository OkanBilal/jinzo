import DropdownWrapper from "../../../../components/ui/dropdown-wrapper";
import { AppState } from "./types";

interface AppMentionDropdownProps {
  isOpen: boolean;
  apps: AppState[];
  onSelectApp: (app: AppState) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
  searchTerm?: string;
}

export default function AppMentionDropdown({
  isOpen,
  apps,
  onSelectApp,
  dropdownRef,
  openUpward = false,
  searchTerm = "",
}: AppMentionDropdownProps) {
  let connectedApps = apps.filter((app) => app.isConnected);

  if (searchTerm) {
    connectedApps = connectedApps.filter((app) =>
      app.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  return (
    <div ref={dropdownRef} className="absolute top-6 left-4">
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={openUpward}
        minWidth="min-w-64"
        useFixedBackground={true}
      >
        {connectedApps.length === 0 ? (
          <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
            {searchTerm
              ? `No apps matching "${searchTerm}"`
              : "No connected apps"}
          </div>
        ) : (
          <>
            <ul className="max-h-80 overflow-auto cursor-pointer" role="menu">
              {connectedApps.map((app) => (
                <li
                  key={app.id}
                  className="flex items-center px-2.5 py-2 first:rounded-t-xl last:rounded-b-xl hover:bg-primary-100 dark:hover:bg-primary-600/20 text-sm"
                  role="menuitem"
                >
                  <button
                    type="button"
                    onClick={() => onSelectApp(app)}
                    className="w-full flex items-center gap-2.5 text-left cursor-pointer"
                  >
                    {app.iconPath && (
                      <img
                        src={app.iconPath}
                        alt={app.displayName}
                        width={28}
                        height={28}
                        className="w-7 h-7 rounded-sm object-cover"
                      />
                    )}
                    <span className="text-primary-800 dark:text-primary-200">
                      {app.displayName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </DropdownWrapper>
    </div>
  );
}
