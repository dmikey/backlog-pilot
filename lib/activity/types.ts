import type { SupportedLibraryPlatform } from "@/lib/library/types";

export const activityClassifications = [
  "Active",
  "Recently Active",
  "Dormant",
  "Abandoned",
  "Completed Candidate",
] as const;

export type ActivityClassification = (typeof activityClassifications)[number];

export interface GameActivity {
  userId: string;
  canonicalGameId: string;
  platform: SupportedLibraryPlatform;
  totalPlaytimeMinutes: number;
  recentPlaytimeMinutes: number;
  lastPlayedAt?: string;
  engagementScore: number;
  updatedAt: string;
}

export interface GameActivityHistoryPoint {
  totalPlaytimeMinutes: number;
  recentPlaytimeMinutes: number;
  lastPlayedAt?: string;
  engagementScore: number;
  recordedAt: string;
}

export interface RecommendationActivitySignal {
  canonicalGameId: string;
  recentlyPlayedBoost: number;
  dormantGameBoost: number;
  activeGameContinuationBonus: number;
  abandonmentRiskScore: number;
  engagementScore: number;
  classification: ActivityClassification;
}

export interface ActivityAnalyticsSummary {
  mostPlayedGames: GameActivity[];
  recentlyPlayedGames: GameActivity[];
  longestDormantGames: GameActivity[];
  activeRotationCandidates: GameActivity[];
  platformUsageDistribution: Array<{
    platform: SupportedLibraryPlatform;
    totalPlaytimeMinutes: number;
  }>;
}

export interface GameActivityWithClassification {
  activity: GameActivity;
  classification: ActivityClassification;
}

export interface SteamPlaytimeSnapshot {
  platformGameId: string;
  totalPlaytimeMinutes: number;
  recentPlaytimeMinutes: number;
  lastPlayedAt?: string;
}
