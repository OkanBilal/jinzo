import { useState } from "react";
import { AppIconProps, AppItem } from "../../../chat/components/input/types";
import Text, {
  Heading2,
  BodyMedium,
  Body,
} from "../../../../components/ui/text";
import AppleMusicModal from "../../components/apps/apple-music/apple-music-modal";
import GitHubModal from "../../components/apps/github/github-modal";
import HackerNewsModal from "../../components/apps/hackernews/hackernews-modal";
import PodcastModal from "../../components/apps/podcast/podcast-modal";
import RaindropModal from "../../components/apps/raindrop/raindrop-modal";
import RssModal from "../../components/apps/rss/rss-modal";
import SpotifyModal from "../../components/apps/spotify/spotify-modal";
import { Button } from "@/components/ui/button";

interface AppsSettingsProps {
  apps: AppItem[];
  connectedApps: string[];
  onRefresh?: () => void;
}

export default function AppsSettings({
  apps,
  connectedApps,
  onRefresh,
}: AppsSettingsProps) {
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showRaindropModal, setShowRaindropModal] = useState(false);
  const [showHackerNewsModal, setShowHackerNewsModal] = useState(false);
  const [showPodcastModal, setShowPodcastModal] = useState(false);
  const [showAppleMusicModal, setShowAppleMusicModal] = useState(false);
  const [showRssModal, setShowRssModal] = useState(false);
  const [showSpotifyModal, setShowSpotifyModal] = useState(false);

  const isConnected = (appId: string) => {
    return connectedApps.includes(appId);
  };

  const handleConnectionSuccess = () => {
    onRefresh?.();
  };

  const handleConnect = (appId: string) => {
    if (appId === "github") {
      setShowGitHubModal(true);
    } else if (appId === "raindrop") {
      setShowRaindropModal(true);
    } else if (appId === "hackernews") {
      setShowHackerNewsModal(true);
    } else if (appId === "podcast") {
      setShowPodcastModal(true);
    } else if (appId === "apple-music") {
      setShowAppleMusicModal(true);
    } else if (appId === "spotify") {
      setShowSpotifyModal(true);
    } else if (appId === "rss") {
      setShowRssModal(true);
    } else {
      /* empty */
    }
  };

  const connectedAppsList = apps.filter((app) => isConnected(app.id));
  const notConnectedAppsList = apps.filter((app) => !isConnected(app.id));

  const renderAppItem = (app: AppItem) => {
    const connected = isConnected(app.id);
    return (
      <div
        key={app.id}
        className={`flex items-center justify-between py-4.5 ${connected ? "" : " last:mb-12"}`}
        role="listitem"
      >
        <div className="flex items-center gap-4">
          <AppIcon app={app} />
          <div className="flex flex-col">
            <BodyMedium className="text-primary-900 dark:text-primary-100">
              {app.displayName}
            </BodyMedium>
            <Body
              className={
                connected
                  ? "text-green-600 dark:text-primary-200! mt-1"
                  : "text-primary-500 dark:text-primary-500 mt-1"
              }
            >
              {connected ? "Connected" : "Disconnected"}
            </Body>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => handleConnect(app.id)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors hover:bg-primary-100 dark:hover:bg-primary-800"
        >
          <Text
            variant="button"
            className="text-primary-900 dark:text-primary-100"
          >
            {connected ? "Manage" : "Connect"}
          </Text>
          <svg
            className="w-4 h-4 text-primary-600 dark:text-primary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
            />
          </svg>
        </Button>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto noscrollbar">
      <Heading2 className="mb-6">Apps</Heading2>
      {apps.length > 0 && (
        <div className="">
          <Text variant="muted" className="mb-4">
            Access information from your connected tools to give you more useful
            answers.
          </Text>

          {connectedAppsList.length > 0 && (
            <div className="mb-6 mt-2">
              <Text variant="labelSmall" className="mb-2">
                Connected
              </Text>
              <div className="" role="list">
                {connectedAppsList.map(renderAppItem)}
              </div>
            </div>
          )}

          <div className="border-b border-primary-200 dark:border-primary-800/50 mb-8" />

          {notConnectedAppsList.length > 0 && (
            <div>
              <Text variant="labelSmall" className="mb-2 ">
                Avaılable
              </Text>
              <div className="" role="list">
                {notConnectedAppsList.map(renderAppItem)}
              </div>
            </div>
          )}
        </div>
      )}

      <GitHubModal
        open={showGitHubModal}
        onClose={() => setShowGitHubModal(false)}
        isConnected={isConnected("github")}
        onSuccess={handleConnectionSuccess}
      />

      <RaindropModal
        open={showRaindropModal}
        onClose={() => setShowRaindropModal(false)}
        isConnected={isConnected("raindrop")}
      />

      <HackerNewsModal
        open={showHackerNewsModal}
        onClose={() => setShowHackerNewsModal(false)}
      />

      <PodcastModal
        open={showPodcastModal}
        onClose={() => setShowPodcastModal(false)}
        isConnected={isConnected("podcast")}
      />

      <AppleMusicModal
        open={showAppleMusicModal}
        onClose={() => setShowAppleMusicModal(false)}
        isConnected={isConnected("apple-music")}
        onSuccess={handleConnectionSuccess}
      />

      <SpotifyModal
        open={showSpotifyModal}
        onClose={() => setShowSpotifyModal(false)}
        isConnected={isConnected("spotify")}
      />

      <RssModal open={showRssModal} onClose={() => setShowRssModal(false)} />
    </div>
  );
}

function AppIcon({ app }: AppIconProps) {
  const name = app.displayName;
  const icon = app.iconPath;
  const id = app.id;

  if (icon) {
    return (
      <img
        src={icon}
        alt={id}
        width={48}
        height={48}
        className="w-12 h-12 rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="w-10 h-10 flex items-center justify-center bg-primary-200 dark:bg-primary-700 rounded-lg">
      <Text variant="h3" className="text-primary-800 dark:text-primary-200">
        {name?.charAt(0)}
      </Text>
    </div>
  );
}
