import { useState } from "react";


import { Apps, Close } from "../../../../components/ui/icons";
import DropdownWrapper from "../../../../components/ui/dropdown-wrapper";
import GitHubModal from "../../../../features/settings/components/apps/github/github-modal";

import { AppListItemProps, ConnectAppsDropdownProps } from "./types";
import Text from "../../../../components/ui/text";

export default function ConnectAppsDropdown({
  isOpen,
  onToggle,
  apps,
  connectedApps,
  onOpenModal,
  dropdownRef,
  openUpward = false,
  selectedApp,
  onClearSelectedApp,
}: ConnectAppsDropdownProps) {
  const [showGitHubModal, setShowGitHubModal] = useState(false);

  const isConnected = (appId: string) => {
    return connectedApps.includes(appId);
  };

  const handleConnect = (appId: string) => {
    if (appId === "github") {
      setShowGitHubModal(true);
    } else { /* empty */ }
  };

  const handleClearApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClearSelectedApp) {
      onClearSelectedApp();
    }
  };

  return (
    <>
      <div className=" relative " ref={dropdownRef}>
        {selectedApp ? (
          <button
            type="button"
            onClick={handleClearApp}
            className="group flex cursor-pointer items-center hover:bg-primary-200/60 dark:hover:bg-primary-700/40 transition-colors rounded-2xl pl-1 pr-2 py-1 gap-1"
            aria-label="Clear app selection"
          >
            <div className="relative w-5 h-5 flex items-center justify-center">
              <div className="absolute inset-0 hidden group-hover:flex items-center justify-center">
                <Close className="w-3 h-3 text-primary-600 dark:text-primary-300" />
              </div>
              {selectedApp.iconPath && (
                <img
                  src={selectedApp.iconPath}
                  alt={selectedApp.displayName}
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded group-hover:hidden"
                />
              )}
            </div>
            {selectedApp.iconPath && (
              <Text
                variant="body"
                className="text-primary-700 dark:text-primary-400"
              >
                {selectedApp.displayName}
              </Text>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="flex cursor-pointer items-center hover:bg-primary-200/60 dark:hover:bg-primary-700/40 transition-colors rounded-2xl pl-2 pr-2 py-1.5"
            aria-haspopup="true"
            aria-expanded={isOpen}
          >
            <Apps className="w-4.5 h-4.5 mr-1 text-primary-500 dark:text-primary-400" />
            <Text
              variant="body"
              className="text-primary-700 dark:text-primary-400"
            >
              Apps
            </Text>
          </button>
        )}
        <DropdownWrapper
          isOpen={isOpen}
          openUpward={openUpward}
          minWidth="min-w-60"
          useFixedBackground={true}
        >
          <ul className="max-h-80 overflow-auto cursor-pointer" role="menu">
            {apps
              .filter((app) => app.highlighted)
              .map((app) => {
                const connected = connectedApps.includes(app.id);
                return (
                  <AppListItem
                    key={app.id}
                    app={app}
                    isConnected={connected}
                    onConnect={handleConnect}
                  />
                );
              })}
          </ul>
          <div className="px-2 py-2">
            <button
              type="button"
              onClick={onOpenModal}
              className="w-full cursor-pointer text-primary-900 dark:text-primary-200 text-xs font-medium px-3 py-2 rounded-xl bg-primary-200/60 dark:bg-primary-700/40 hover:bg-primary-200 dark:hover:bg-primary-700 transition-colors"
            >
              Connect More
            </button>
          </div>
        </DropdownWrapper>
      </div>
      <GitHubModal
        open={showGitHubModal}
        onClose={() => setShowGitHubModal(false)}
        isConnected={isConnected("github")}
      />
    </>
  );
}

function AppListItem({ app, isConnected, onConnect }: AppListItemProps) {
  const name = app.displayName;
  const id = app.id;
  const icon = app.iconPath;

  return (
    <li
      className="flex items-center justify-between px-2.5 py-2 first:rounded-t-lg hover:bg-primary-100 dark:hover:bg-primary-600/20 text-sm"
      role="menuitem"
    >
      <button
        onClick={() => onConnect(id)}
        className="cursor-pointer flex items-center gap-2 flex-1 text-left"
      >
        {icon ? (
          <img
            src={icon}
            alt={id}
            width={512}
            height={512}
            className="w-7 h-7 rounded-sm object-cover"
          />
        ) : (
          <div className="w-7 h-7 flex items-center justify-center bg-primary-200 dark:bg-primary-700 rounded-sm">
            <Text
              variant="bodySmall"
              className="font-semibold text-primary-800 dark:text-primary-200"
            >
              {name?.charAt(0)}
            </Text>
          </div>
        )}
        <Text variant="body" className="text-primary-800 dark:text-primary-200">
          {name}
        </Text>
      </button>
      <button onClick={() => onConnect(id)} className="cursor-pointer shrink-0">
        <Text
          variant="bodySmall"
          className="text-primary-800 dark:text-primary-200"
        >
          {isConnected ? "Connected" : "Connect"}
        </Text>
      </button>
    </li>
  );
}
