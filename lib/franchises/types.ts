import type { Franchise, Game, GameMetadata, Series } from "@/lib/domain/types";
import type { LibraryGameWithOwnership } from "@/lib/library/types";

export interface FranchiseCatalog {
  games: Game[];
  metadata: GameMetadata[];
  franchises: Franchise[];
  series: Series[];
}

export interface FranchiseTrackingOptions {
  excludeArchived?: boolean;
}

export interface TrackedFranchiseGroup {
  franchise: Franchise;
  catalogGames: Game[];
  libraryGames: LibraryGameWithOwnership[];
}

export interface TrackedSeriesGroup {
  series: Series;
  catalogGames: Game[];
  libraryGames: LibraryGameWithOwnership[];
}

export interface SeriesProgress {
  seriesId: string;
  franchiseId: string;
  userId: string;
  seriesName: string;
  totalOwned: number;
  totalCompleted: number;
  totalActive: number;
  totalAbandoned: number;
  totalUnplayed: number;
  totalCatalogGames: number;
  completionPercentage: number;
  nextRecommendedGameId?: string;
  nextRecommendedGameTitle?: string;
}

export interface FranchiseProgress {
  franchiseId: string;
  userId: string;
  franchiseName: string;
  totalOwned: number;
  totalCompleted: number;
  totalActive: number;
  totalAbandoned: number;
  totalUnplayed: number;
  totalCatalogGames: number;
  completionPercentage: number;
  nextRecommendedGameId?: string;
  nextRecommendedGameTitle?: string;
  series: SeriesProgress[];
}

export interface FranchiseRecommendationSignalSet {
  franchiseId: string;
  franchiseName: string;
  nextRecommendedGameId?: string;
  nextRecommendedGameTitle?: string;
  nearFranchiseCompletionBonus: number;
  abandonedFranchisePenalty: number;
  franchiseAffinityScore: number;
  seriesContinuationBonus: number;
}

export type FranchiseCampaignType =
  | "complete_trilogy"
  | "complete_franchise"
  | "complete_series"
  | "finish_one_game_per_franchise"
  | "finish_oldest_unplayed_entry"
  | "resume_abandoned_franchise";

export interface FranchiseCampaign {
  franchiseId: string;
  franchiseName: string;
  type: FranchiseCampaignType;
  description: string;
  remainingGames: number;
  nextRecommendedGameId?: string;
  nextRecommendedGameTitle?: string;
}

export interface FranchiseDashboardSummary {
  closestFranchisesToCompletion: FranchiseProgress[];
  largestUnfinishedFranchises: FranchiseProgress[];
  mostCompletedFranchises: FranchiseProgress[];
  abandonedFranchiseRuns: FranchiseProgress[];
  activeFranchiseCampaigns: FranchiseCampaign[];
}

export interface FranchiseProgressSnapshot {
  franchises: FranchiseProgress[];
  series: SeriesProgress[];
  summary: FranchiseDashboardSummary;
}
