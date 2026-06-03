export const platformIds = [
  "steam",
  "nintendo-switch",
  "gba",
  "psp",
  "psvita",
] as const;

export const ownershipTypes = ["physical", "digital", "rom", "subscription"] as const;

export const completionStatuses = [
  "unplayed",
  "in_progress",
  "completed",
  "abandoned",
  "on_hold",
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
export type OwnershipType = (typeof ownershipTypes)[number];
export type CompletionStatus = (typeof completionStatuses)[number];
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

export interface Franchise {
  id: string;
  name: string;
  normalizedName: string;
}

export interface Series {
  id: string;
  franchiseId: string;
  name: string;
  normalizedName: string;
}

export interface Genre {
  id: string;
  name: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface ImageAsset {
  url: string;
  alt: string;
}

export type EditionKind = "standard" | "remaster" | "port" | "definitive" | "collection";

export interface GameEdition {
  kind: EditionKind;
  label: string;
  canonicalEditionKey: string;
}

export interface Game {
  id: string;
  canonicalTitle: string;
  normalizedTitle: string;
  aliases: string[];
  normalizedAliases: string[];
  franchiseId?: string;
  seriesId?: string;
  description: string;
  releaseDate: string;
  developer: string[];
  publisher: string[];
  genres: Genre[];
  tags: Tag[];
  coverArt: ImageAsset;
  screenshots: ImageAsset[];
  edition: GameEdition;
  slug: string;
  title: string;
  year: number;
}

export interface GameMetadata {
  gameId: string;
  externalIds: {
    steamAppId?: string;
    nintendoTitleId?: string;
    giantBombId?: string;
    igdbId?: string;
    metacriticSlug?: string;
  };
  aliasMatchKeys: string[];
  editionMatchKeys: string[];
  duplicateDetectionKey: string;
  completionTimeHours: {
    main: number;
    completionist?: number;
  };
  reviewScore?: number;
  popularity?: number;
  genreWeights?: Record<string, number>;
  franchiseCompletionWeight?: number;
  franchise: string;
  estimatedHours: number;
  completionLikelihood: "high" | "medium" | "low";
  mood: string;
  duplicateOwnershipNote?: string;
}

export interface PlatformEntry {
  id: string;
  gameId: string;
  platform: PlatformId;
  platformGameId: string;
  ownershipType: OwnershipType;
  acquiredDate?: string;
  playtimeHours?: number;
  completionStatus: CompletionStatus;
  platformMetadata?: {
    editionLabel?: string;
    region?: string;
    storefrontUrl?: string;
    romSet?: string;
  };
}

export interface LibraryEntry {
  id: string;
  householdId: string;
  userId: string;
  platformEntryId?: string;
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
