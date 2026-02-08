import {
  fetchPodcastsFromConnectionResources,
  fetchRaindropFromConnectionResources,
  fetchRssFromConnectionResources,
  fetchAppleMusicFromConnectionResources,
  fetchSpotifyFromConnectionResources,
  fetchGitHubFromConnectionResources,
  fetchLinearFromConnectionResources,
  fetchJiraFromConnectionResources,
  fetchAsanaFromConnectionResources,
  fetchHackerNewsFromConnectionResources,
} from "./connections";
import type { EntityInput } from "./sync.dto";

export const FETCH_LIMITS = {
  GITHUB_ISSUES: 50,
  GITHUB_PRS: 50,
  LINEAR_ISSUES: 50,
  JIRA_ISSUES: 50,
  ASANA_TASKS: 50,
  RAINDROP: 20,
  HACKERNEWS_TOP: 20,
  HACKERNEWS_NEW: 20,
  HACKERNEWS_USER: 10,
  PODCASTS: 10,
  RSS: 10,
} as const;

export async function fetchAllEntities(): Promise<EntityInput[]> {
  try {
    const [
      githubEntities,
      linearEntities,
      jiraEntities,
      asanaEntities,
      raindropEntities,
      hackerNewsEntities,
      podcastEntities,
      appleMusicEntities,
      spotifyEntities,
      rssEntities,
    ] = await Promise.all([
      fetchGitHubFromConnectionResources(
        FETCH_LIMITS.GITHUB_ISSUES,
        FETCH_LIMITS.GITHUB_PRS,
      ),
      fetchLinearFromConnectionResources(FETCH_LIMITS.LINEAR_ISSUES),
      fetchJiraFromConnectionResources(FETCH_LIMITS.JIRA_ISSUES),
      fetchAsanaFromConnectionResources(FETCH_LIMITS.ASANA_TASKS),
      fetchRaindropFromConnectionResources(FETCH_LIMITS.RAINDROP),
      fetchHackerNewsFromConnectionResources(
        FETCH_LIMITS.HACKERNEWS_TOP,
        FETCH_LIMITS.HACKERNEWS_NEW,
        FETCH_LIMITS.HACKERNEWS_USER,
      ),
      fetchPodcastsFromConnectionResources(FETCH_LIMITS.PODCASTS),
      fetchAppleMusicFromConnectionResources(),
      fetchSpotifyFromConnectionResources(),
      fetchRssFromConnectionResources(FETCH_LIMITS.RSS),
    ]);

    const entities = [
      ...githubEntities,
      ...linearEntities,
      ...jiraEntities,
      ...asanaEntities,
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
