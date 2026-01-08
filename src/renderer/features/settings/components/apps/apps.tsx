"use client";

import { useState } from "react";
import { AppIconProps, AppItem } from "../../../chat/components/input/types";
import Text, { Heading2, BodyMedium } from "../../../../components/ui/text";
import AppleMusicModal from "../../components/apps/apple-music/apple-music-modal";
import GitHubModal from "../../components/apps/github/github-modal";
import HackerNewsModal from "../../components/apps/hackernews/hackernews-modal";
import PodcastModal from "../../components/apps/podcast/podcast-modal";
import RaindropModal from "../../components/apps/raindrop/raindrop-modal";
import RssModal from "../../components/apps/rss/rss-modal";
import SpotifyModal from "../../components/apps/spotify/spotify-modal";

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
    }
  };

  const connectedAppsList = apps.filter((app) => isConnected(app.id));
  const notConnectedAppsList = apps.filter((app) => !isConnected(app.id));

  const renderAppItem = (app: AppItem) => {
    const connected = isConnected(app.id);
    return (
      <div
        key={app.id}
        className="flex items-center  justify-between p-2 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-800 "
        role="listitem"
      >
        <div className="flex items-center gap-3">
          <AppIcon app={app} />
          <BodyMedium>{app.displayName}</BodyMedium>
        </div>
        <button
          onClick={() => handleConnect(app.id)}
          className={` rounded-lg cursor-pointer transition-colors ${
            connected
              ? " text-primary-700 dark:text-primary-500 "
              : " text-primary-900 dark:text-primary-200 "
          }`}
        >
          <Text variant="button">{connected ? "Connected" : "Connect"}</Text>
        </button>
      </div>
    );
  };

  return (
    <div className="">
      <Heading2 className="mb-6">Apps</Heading2>
      {apps.length > 0 && (
        <div>
          <Text variant="mutedSmall" className="mb-4">
            Access information from your connected tools to give you more useful
            answers.
          </Text>

          {connectedAppsList.length > 0 && (
            <div className="mb-6">
              <Text variant="labelSmall" className="mb-2">
                Connected
              </Text>
              <div className="space-y-1" role="list">
                {connectedAppsList.map(renderAppItem)}
              </div>
            </div>
          )}

          {notConnectedAppsList.length > 0 && (
            <div>
              <Text variant="labelSmall" className="mb-2">
                Available
              </Text>
              <div className="space-y-1" role="list">
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

      <RssModal
        open={showRssModal}
        onClose={() => setShowRssModal(false)}
      />
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
        width={40}
        height={40}
        className="w-10 h-10 rounded-lg object-cover"
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
