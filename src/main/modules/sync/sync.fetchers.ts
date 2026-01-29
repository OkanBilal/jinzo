import { FETCH_LIMITS } from "../chat/chat.constants";
import {
  fetchPodcastsFromConnectionResources,
  fetchRaindropFromConnectionResources,
  fetchRssFromConnectionResources,
  fetchAppleMusicFromConnectionResources,
  fetchSpotifyFromConnectionResources,
  fetchGitHubFromConnectionResources,
  fetchLinearFromConnectionResources,
  fetchHackerNewsFromConnectionResources,
} from "./connections";
import type { EntityInput } from "./sync.dto";

// ─────────────────────────────────────────────────────────────
// Fetchers - Fetch entities from all sources
// ─────────────────────────────────────────────────────────────
export async function fetchAllEntities(): Promise<EntityInput[]> {
  try {
    const [
      githubEntities,
      linearEntities,
      raindropEntities,
      hackerNewsEntities,
      podcastEntities,
      appleMusicEntities,
      spotifyEntities,
      rssEntities,
    ] = await Promise.all([
      fetchGitHubFromConnectionResources(
        FETCH_LIMITS.GITHUB_ISSUES,
        FETCH_LIMITS.GITHUB_PRS
      ),
      fetchLinearFromConnectionResources(FETCH_LIMITS.LINEAR_ISSUES),
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

    const entities = [
      ...githubEntities,
      ...linearEntities,
      ...raindropEntities,
      ...hackerNewsEntities,
      ...podcastEntities,
      ...appleMusicEntities,
      ...spotifyEntities,
      ...rssEntities,
    ];

    console.log(`📥 Fetched ${entities.length} entities from sources`);
    return entities;
  } catch (error) {
    console.error("Error fetching entities:", error);
    throw error;
  }
}
