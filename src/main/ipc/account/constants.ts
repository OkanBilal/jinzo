export const ACCOUNT_ID = "default";

export const DEFAULT_ACCOUNT_RESPONSE = {
  id: ACCOUNT_ID,
  displayName: "",
  email: "",
  company: "",
  jobTitle: "",
  timezone: "UTC",
  locale: "en-US",
  website: "",
  avatarUrl: "",
  bio: "",
  createdAt: null as Date | null,
  updatedAt: null as Date | null,
};

export const FIELD_LIMITS = {
  displayName: 120,
  email: 160,
  company: 160,
  jobTitle: 120,
  timezone: 80,
  locale: 16,
  website: 200,
  avatarUrl: 300,
  bio: 2000,
} as const;
