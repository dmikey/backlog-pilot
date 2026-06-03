export const platformIds = [
  "steam",
  "nintendo-switch",
  "gba",
  "psp",
  "psvita",
] as const;

export const playStatuses = [
  "backlog",
  "active",
  "next_up",
  "completed",
  "abandoned",
  "archived",
] as const;

export const importSourceIds = [
  "steam",
  "nintendo_switch",
  "gba",
  "psp",
  "psvita",
] as const;

export type PlatformId = (typeof platformIds)[number];
export type PlayStatus = (typeof playStatuses)[number];
export type ImportSource = (typeof importSourceIds)[number];

export interface User {
  id: string;
  displayName: string;
  roleLabel: string;
  householdId: string;
}

export interface Household {
  id: string;
  name: string;
  timezone: string;
}

export interface Platform {
  id: PlatformId;
  name: string;
  shortName: string;
  releaseEra: "modern" | "retro";
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  year: number;
}

export interface GameMetadata {
  gameId: string;
  gameFamily: string;
  franchise: string;
  estimatedHours: number;
  completionLikelihood: "high" | "medium" | "low";
  mood: string;
  duplicateOwnershipNote?: string;
}

export interface LibraryEntry {
  id: string;
  householdId: string;
  userId: string;
  gameId: string;
  platformId: PlatformId;
  importSource: ImportSource;
  playStatus: PlayStatus;
  ownedDays: number;
}

export interface RecommendationReason {
  id: string;
  title: string;
  detail: string;
}

export interface Recommendation {
  id: string;
  householdId: string;
  userId: string;
  gameId: string;
  platformId: PlatformId;
  score: number;
  headline: string;
  reasons: RecommendationReason[];
}

export interface ImportSourceDefinition {
  id: ImportSource;
  label: string;
  platformId: PlatformId;
  firstRunCopy: string;
}
