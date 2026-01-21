export interface MoodPayload {
  name: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  icon?: string;
  themeConfig?: string;
  uiConfig?: string;
  sortOrder?: number;
}

export interface SanitizedMoodResult {
  data: Partial<MoodPayload>;
  errors: Record<string, string>;
}
