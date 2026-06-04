import type { GameMetadata } from "@/lib/domain/types";
import type { RecommendationActivitySignal } from "@/lib/activity/types";

export const sessionCategories = [
  "Micro Session",
  "Short Session",
  "Standard Session",
  "Long Session",
  "Marathon Session",
] as const;

export type SessionCategory = (typeof sessionCategories)[number];

export interface SessionCategoryDefinition {
  id: string;
  label: SessionCategory;
  minMinutes: number;
  maxMinutes?: number;
}

export interface SessionProfile {
  primaryCategory: SessionCategory;
  supportedCategories: SessionCategory[];
  idealSessionMinutes: number;
}

export interface SessionFitInput {
  metadata: GameMetadata;
  availableMinutes: number;
  playtimeHours?: number;
  activitySignal?: RecommendationActivitySignal;
}

export interface SessionFitAssessment {
  sessionFitScore: number;
  profile: SessionProfile;
  progressOpportunityScore: number;
  sessionSatisfactionScore: number;
  explanation: string;
}

export interface SessionRecommendationSignal {
  canonicalGameId: string;
  sessionFitBonus: number;
  sessionMismatchPenalty: number;
  quickWinBonus: number;
  longSessionBonus: number;
}

export interface CompletionVelocityEstimate {
  estimatedTotalHours: number;
  estimatedRemainingHours: number;
  estimatedSessionsRequired: number;
  estimatedWeeksRequired: number;
  likelyCompletionDate: string;
}
