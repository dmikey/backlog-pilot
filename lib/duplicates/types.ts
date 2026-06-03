import type { EditionKind, Game } from "@/lib/domain/types";
import type { LibraryGameWithOwnership, SupportedLibraryPlatform } from "@/lib/library/types";

export const duplicateSeverityLevels = ["None", "Low", "Medium", "High"] as const;
export type DuplicateSeverity = (typeof duplicateSeverityLevels)[number];

export interface DuplicateOwnershipRecord {
  libraryGameId: string;
  canonicalGameId: string;
  canonicalTitle: string;
  franchiseId?: string;
  genreIds: string[];
  editionKind: EditionKind;
  platform: SupportedLibraryPlatform;
  platformGameId: string;
  source: string;
  ownershipType: string;
  acquiredAt?: string;
}

export interface OwnershipGroup {
  canonicalGameId: string;
  canonicalTitle: string;
  ownershipRecords: DuplicateOwnershipRecord[];
  preferredPlatform: SupportedLibraryPlatform;
  duplicateCount: number;
  duplicateScore: DuplicateSeverity;
  platforms: SupportedLibraryPlatform[];
  relatedCanonicalGameIds: string[];
}

export interface DuplicateSummary {
  totalOwnershipRecords: number;
  duplicateOwnershipRecords: number;
  totalDuplicateGames: number;
  duplicateOwnershipRate: number;
  duplicateOwnershipPercentage: number;
  mostDuplicatedGenres: Array<{ genreId: string; count: number }>;
  mostDuplicatedFranchises: Array<{ franchiseId: string; count: number }>;
  preferredPlatforms: Array<{ platform: SupportedLibraryPlatform; count: number }>;
  duplicatePurchaseFrequency: number;
}

export interface PurchaseSignal {
  canonicalGameId: string;
  ownershipCount: number;
  ownedPlatforms: SupportedLibraryPlatform[];
  preferredPlatform?: SupportedLibraryPlatform;
  recommendation: "Skip" | "Consider";
  duplicateScore: DuplicateSeverity;
}

export interface RecommendationSignal {
  canonicalGameId: string;
  duplicateCount: number;
  duplicateScore: DuplicateSeverity;
  preferredPlatform: SupportedLibraryPlatform;
  penaltyMultiplier: number;
}

export interface GroupingOptions {
  preferredPlatforms?: SupportedLibraryPlatform[];
  collectionComponentsByGameId?: Record<string, string[]>;
}

export interface OwnershipGroupSeed {
  entry: LibraryGameWithOwnership;
  game: Game;
  metadataDuplicateKey: string;
}
