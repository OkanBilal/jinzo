export const FETCH_LIMITS = {
  GITHUB_ISSUES: 10,
  GITHUB_PRS: 10,
  RAINDROP: 10,
  HACKERNEWS_TOP: 10,
  HACKERNEWS_NEW: 10,
  HACKERNEWS_USER: 10,
  PODCASTS: 5,
  RSS: 5,
} as const;


export const IMAGE_SRC_REGEX = /<img[^>]+src=["']([^"'>]+)["']/i;
