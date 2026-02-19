import { useState } from "react";
import { AppIconProps, AppItem } from "../../../chat/components/input/types";
import Text, {
  Heading2,
  BodyMedium,
  Body,
} from "../../../../components/ui/text";
import AppleMusicModal from "../../components/apps/apple-music/apple-music-modal";
import AsanaModal from "../../components/apps/asana/asana-modal";
import GitHubModal from "../../components/apps/github/github-modal";
import GitLabModal from "../../components/apps/gitlab/gitlab-modal";
import HackerNewsModal from "../../components/apps/hackernews/hackernews-modal";
import JiraModal from "../../components/apps/jira/jira-modal";
import LinearModal from "../../components/apps/linear/linear-modal";
import PodcastModal from "../../components/apps/podcast/podcast-modal";
import RssModal from "../../components/apps/rss/rss-modal";
import SpotifyModal from "../../components/apps/spotify/spotify-modal";
import { Button } from "@/components/ui/button";
import RaindropModal from "./raindrop/raindrop-modal";
import { External } from "@/components/ui/icons";

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
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const isConnected = (appId: string) => {
    return connectedApps.includes(appId);
  };

  const handleConnectionSuccess = () => {
    onRefresh?.();
  };

  const handleConnect = (appId: string) => {
    setActiveModal(appId);
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
          variant={connected ? "primary" : "secondary"}
          onClick={() => handleConnect(app.id)}
          className="flex gap-2"
        >
          <Text variant="button" className="">
            {connected ? "Manage" : "Connect"}
          </Text>
          {connected ? null : <External className="w-4 h-4 " />}
        </Button>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto noscrollbar">
      <Heading2 className="mb-6">Connections</Heading2>
      {apps.length > 0 && (
        <div className="">
          {/* <Text variant="muted" className="mb-4">
            Access information from your connected tools to give you more useful
            answers.
          </Text> */}

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
        open={activeModal === "github"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("github")}
        onSuccess={handleConnectionSuccess}
      />

      <GitLabModal
        open={activeModal === "gitlab"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("gitlab")}
        onSuccess={handleConnectionSuccess}
      />

      <JiraModal
        open={activeModal === "jira"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("jira")}
        onSuccess={handleConnectionSuccess}
      />

      <AsanaModal
        open={activeModal === "asana"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("asana")}
        onSuccess={handleConnectionSuccess}
      />

      <LinearModal
        open={activeModal === "linear"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("linear")}
        onSuccess={handleConnectionSuccess}
      />

      <RaindropModal
        open={activeModal === "raindrop"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("raindrop")}
      />

      <HackerNewsModal
        open={activeModal === "hackernews"}
        onClose={() => setActiveModal(null)}
      />

      <PodcastModal
        open={activeModal === "podcast"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("podcast")}
      />

      <AppleMusicModal
        open={activeModal === "apple-music"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("apple-music")}
        onSuccess={handleConnectionSuccess}
      />

      <SpotifyModal
        open={activeModal === "spotify"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("spotify")}
      />

      <RssModal open={activeModal === "rss"} onClose={() => setActiveModal(null)} />
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
