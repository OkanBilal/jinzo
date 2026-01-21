export interface SaveCredentialsPayload {
  provider: string;
  connectionId: string;
  // Provider-specific fields
  token?: string;           // github, raindrop
  apiKey?: string;          // podcast
  userId?: string;          // podcast
  developerToken?: string;  // apple-music
  userToken?: string;       // apple-music
  accessToken?: string;     // spotify
  [key: string]: any;
}

export interface CredentialsCheckResult {
  hasCredentials: boolean;
  status: string;
  connectionId: string;
}

export interface ParsedCredentials {
  accessToken: string | null;
  refreshToken: string | null;
  tokensForHash: string[];
}
