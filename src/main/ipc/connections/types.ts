export interface GithubRepo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string | null;
}

export interface RaindropCollection {
  id: number;
  title: string;
  count: number;
  public: boolean;
  cover: string | null;
  color: string | null;
  created: string;
  lastUpdate: string;
}

export interface HackerNewsSettings {
  topStories: boolean;
  userSubmissions: boolean;
  userComments: boolean;
}

export interface HackerNewsTogglePayload {
  enabled: boolean;
  username?: string;
  topStories?: boolean;
  userSubmissions?: boolean;
  userComments?: boolean;
}

export interface SaveResourcesPayload {
  provider: string;
  connectionId: string;
  resources?: any[];
  sources?: string[];
}

export interface PodcastResource {
  name: string;
  uuid: string;
  imageUrl?: string;
  description?: string;
}

export interface RssFeed {
  name: string;
  url: string;
}

export interface ConnectionResource {
  id: string;
  connectionId: string;
  externalId: string;
  kind: string;
  name: string;
  url?: string | null;
  selected: boolean;
  metadata: string | null;
  lastSeenAt: Date;
  lastIngestAt: Date | null;
}
