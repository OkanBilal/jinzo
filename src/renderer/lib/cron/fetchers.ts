import {
  fetchPodcastsFromConnectionResources,
  fetchRaindropFromConnectionResources,
  fetchRssFromConnectionResources,
  fetchAppleMusicFromConnectionResources,
  fetchSpotifyFromConnectionResources,
  fetchGitHubFromConnectionResources,
  fetchHackerNewsFromConnectionResources,
} from "../../../renderer/lib/cron/connections";
import type { FeedItem } from "../../../renderer/lib/cron/types";
import { FETCH_LIMITS } from "../../../renderer/lib/config";

export async function fetchAllFeedItems(): Promise<FeedItem[]> {
  try {
    const [
      githubItems,
      raindropItems,
      hackerNewsItems,
      podcastItems,
      appleMusicItems,
      spotifyItems,
      rssItems,
    ] = await Promise.all([
      fetchGitHubFromConnectionResources(
        FETCH_LIMITS.GITHUB_ISSUES,
        FETCH_LIMITS.GITHUB_PRS
      ),
      fetchRaindropFromConnectionResources(FETCH_LIMITS.RAINDROP),
      fetchHackerNewsFromConnectionResources(
        FETCH_LIMITS.HACKERNEWS_TOP,
        FETCH_LIMITS.HACKERNEWS_NEW,
        FETCH_LIMITS.HACKERNEWS_USER
      ),
      fetchPodcastsFromConnectionResources(FETCH_LIMITS.PODCASTS),
      fetchAppleMusicFromConnectionResources(),
      fetchSpotifyFromConnectionResources(),
      fetchRssFromConnectionResources(FETCH_LIMITS.RSS),
    ]);

    const items = [
      ...githubItems,
      ...raindropItems,
      ...hackerNewsItems,
      ...podcastItems,
      ...appleMusicItems,
      ...spotifyItems,
      ...rssItems,
    ];

    console.log(`📥 Fetched ${items.length} items from sources`);
    return items;
  } catch (error) {
    console.error("Error fetching feed items:", error);
    throw error;
  }
}
