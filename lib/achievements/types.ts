import type { SupportedLibraryPlatform } from "@/lib/library/types";

export const masteryStatuses = [
  "Not Started",
  "In Progress",
  "Near Completion",
  "Completed",
  "Mastered",
] as const;

export type MasteryStatus = (typeof masteryStatuses)[number];

export interface AchievementProgress {
  userId: string;
  canonicalGameId: string;
  platform: SupportedLibraryPlatform;
  totalAchievements: number;
  unlockedAchievements: number;
  completionPercentage: number;
  masteryStatus: MasteryStatus;
  updatedAt: string;
}

export interface CompletionSignal {
  canonicalGameId: string;
  completionPercentage: number;
  completionCandidate: boolean;
  masteryCandidate: boolean;
  franchiseMomentum: number;
  achievementEngagementScore: number;
  masteryStatus: MasteryStatus;
}

export interface RecommendationAchievementSignal {
  canonicalGameId: string;
  completionPercentage: number;
  masteryStatus: MasteryStatus;
  nearCompletionBonus: number;
  achievementMomentumBonus: number;
  masteryOpportunityBonus: number;
  abandonmentRiskScore: number;
}

export interface AchievementAnalyticsSummary {
  mostCompletedGames: AchievementProgress[];
  nearCompletionOpportunities: AchievementProgress[];
  franchiseCompletionOpportunities: Array<{
    franchiseId: string;
    franchiseName: string;
    trackedGames: number;
    averageCompletionPercentage: number;
  }>;
  masteredGames: AchievementProgress[];
  achievementEngagementRankings: CompletionSignal[];
}
