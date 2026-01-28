/**
 * Normalize a repository URL to an "owner/repo" slug.
 *
 * Handles:
 *  - git@github.com:OkanBilal/feed.git   → OkanBilal/feed
 *  - https://github.com/OkanBilal/feed.git → OkanBilal/feed
 *  - https://github.com/OkanBilal/feed     → OkanBilal/feed
 *
 * Returns null if the URL doesn't match a known pattern.
 */
export function normalizeRepoUrl(repoUrl: string | null | undefined): string | null {
  if (!repoUrl) return null;

  // SSH format: git@github.com:owner/repo.git
  const sshMatch = repoUrl.match(/git@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];

  // HTTPS format: https://github.com/owner/repo(.git)?
  const httpsMatch = repoUrl.match(/https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];

  return null;
}

/** Check if an activeTab ID represents an issue tab. */
export function isIssueTab(tabId: string): boolean {
  return tabId.startsWith("issue:");
}

/** Extract the entityId from an issue tab ID. */
export function getIssueEntityId(tabId: string): string {
  return tabId.slice(6);
}

/** Build a stable tab ID for an issue entity. */
export function makeIssueTabId(entityId: string): string {
  return `issue:${entityId}`;
}
