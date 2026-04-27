/**
 * Trello Connection Fetcher
 *
 * Fetches cards from Trello using REST API.
 * Authentication uses API Key + Token (query params).
 *
 * Trello-specific assumptions:
 * - Uses Trello REST API v1 (https://api.trello.com/1/)
 * - Credentials stored as: accessToken = token, apiKey in connection metadata
 * - Boards are stored as connectionResources with kind = "trello_board"
 * - Cards are normalized to EntityInput with provider = "trello" and kind = "issue"
 */

import type { EntityInput } from "../sync.dto";
import {
  getConnectionWithSecrets,
  getSelectedResources,
  normalizeLimit,
  normalizeDateToIso,
} from "../sync.connection-utils";

const TRELLO_BASE_URL = "https://api.trello.com/1";
const MAX_ITEMS_PER_PAGE = 100;
const DEFAULT_LIMIT = 50;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface TrelloConnection {
  id: string;
  token: string;
  apiKey: string;
}

interface TrelloResource {
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  metadata: Record<string, unknown>;
}

interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  shortUrl: string;
  idShort: number;
  shortLink: string;
  dateLastActivity: string;
  closed: boolean;
  due: string | null;
  dueComplete: boolean;
  labels: TrelloLabel[];
  idMembers: string[];
  idList: string;
}

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

export interface TrelloBoardInfo {
  id: string;
  name: string;
  shortLink: string;
  shortUrl: string;
  closed: boolean;
  desc: string;
  prefs: {
    background: string;
    backgroundColor: string | null;
  };
  organization?: {
    displayName: string;
  } | null;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function buildAuthParams(apiKey: string, token: string): string {
  return `key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(token)}`;
}

// ─────────────────────────────────────────────────────────────
// Connection & Credentials
// ─────────────────────────────────────────────────────────────

async function getConnection(): Promise<TrelloConnection | null> {
  const connection = await getConnectionWithSecrets("trello");
  if (!connection?.secrets.token || !connection?.secrets.apiKey) return null;

  return {
    id: connection.id,
    token: connection.secrets.token,
    apiKey: connection.secrets.apiKey,
  };
}

async function getSelectedBoards(
  connectionId: string
): Promise<TrelloResource[]> {
  const resources = await getSelectedResources(connectionId, "trello_board");

  return resources.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    externalId: r.externalId,
    name: r.name,
    metadata: r.metadata,
  }));
}

// ─────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────

/**
 * Fetch available boards from Trello
 */
export async function fetchTrelloBoards(
  apiKey: string,
  token: string
): Promise<TrelloBoardInfo[]> {
  try {
    const authParams = buildAuthParams(apiKey, token);
    const response = await fetch(
      `${TRELLO_BASE_URL}/members/me/boards?${authParams}&fields=id,name,shortLink,shortUrl,closed,desc,prefs,organization&filter=open`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Trello API error (${response.status}):`, error);
      throw new Error(`Trello API error: ${response.status}`);
    }

    const boards = (await response.json()) as TrelloBoardInfo[];
    return boards.filter((b) => !b.closed);
  } catch (error) {
    console.error("Failed to fetch Trello boards:", error);
    throw error;
  }
}

/**
 * Fetch lists for a board (used to map card list names)
 */
async function fetchBoardLists(
  boardId: string,
  apiKey: string,
  token: string
): Promise<Map<string, string>> {
  try {
    const authParams = buildAuthParams(apiKey, token);
    const response = await fetch(
      `${TRELLO_BASE_URL}/boards/${boardId}/lists?${authParams}&fields=id,name,closed&filter=open`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) return new Map();

    const lists = (await response.json()) as TrelloList[];
    const listMap = new Map<string, string>();
    for (const list of lists) {
      listMap.set(list.id, list.name);
    }
    return listMap;
  } catch {
    return new Map();
  }
}

/**
 * Fetch cards from a specific Trello board
 */
export async function fetchTrelloCards(
  boardId: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string,
  token?: string,
  apiKey?: string
): Promise<EntityInput[]> {
  let actualToken = token;
  let actualApiKey = apiKey;
  let actualConnectionId = connectionId;

  if (!actualToken || !actualApiKey) {
    const connection = await getConnection();
    if (!connection) {
      console.warn("Trello credentials not configured. Cannot fetch cards.");
      return [];
    }
    actualToken = connection.token;
    actualApiKey = connection.apiKey;
    actualConnectionId = actualConnectionId || connection.id;
  }

  const normalizedLimit = normalizeLimit(limit, 1, MAX_ITEMS_PER_PAGE);
  const authParams = buildAuthParams(actualApiKey!, actualToken!);

  try {
    // Fetch lists for list name mapping
    const listMap = await fetchBoardLists(boardId, actualApiKey!, actualToken!);

    // Fetch open cards from the board
    const fields = "id,name,desc,shortUrl,idShort,shortLink,dateLastActivity,closed,due,dueComplete,labels,idMembers,idList";
    const response = await fetch(
      `${TRELLO_BASE_URL}/boards/${boardId}/cards?${authParams}&fields=${fields}&filter=open&limit=${normalizedLimit}`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Trello API error (${response.status}):`, error);
      return [];
    }

    const cards = (await response.json()) as TrelloCard[];

    return cards.map((card): EntityInput => {
      const labelNames = (card.labels || []).map((l) => l.name).filter(Boolean);
      const listName = listMap.get(card.idList) || null;

      return {
        kind: "issue",
        title: card.name,
        url: card.shortUrl,
        body: card.desc || null,
        summary: card.desc?.substring(0, 500) || null,
        occurredAt: normalizeDateToIso(card.dateLastActivity),
        externalId: `${boardId}#${card.idShort}`,
        connectionId: actualConnectionId || null,
        resourceId: resourceId || null,
        metadata: {
          provider: "trello",
          cardId: card.id,
          boardId,
          idShort: card.idShort,
          shortLink: card.shortLink,
          closed: card.closed,
          due: card.due,
          dueComplete: card.dueComplete,
          listName,
          labels: labelNames,
          memberCount: card.idMembers?.length || 0,
          // For compatibility with existing issue table columns
          repo: boardId,
          number: card.idShort,
          state: card.closed ? "closed" : "open",
        },
      };
    });
  } catch (error) {
    console.error(`Failed to fetch Trello cards for board ${boardId}:`, error);
    return [];
  }
}

/**
 * Main entry point: Fetch cards from all selected Trello boards
 */
export async function fetchTrelloFromConnectionResources(
  cardsPerBoard = DEFAULT_LIMIT
): Promise<EntityInput[]> {
  const connection = await getConnection();
  if (!connection) {
    console.warn("⚠️  Skipping Trello: No active connection found");
    return [];
  }

  const boards = await getSelectedBoards(connection.id);
  if (boards.length === 0) {
    console.warn("⚠️  No selected Trello boards found");
    return [];
  }

  const allItems: EntityInput[] = [];

  // Execute sequentially to avoid rate limits
  for (const resource of boards) {
    const boardId = resource.externalId;

    const cards = await fetchTrelloCards(
      boardId,
      cardsPerBoard,
      connection.id,
      resource.id,
      connection.token,
      connection.apiKey
    );

    allItems.push(...cards);
  }

  return allItems;
}
