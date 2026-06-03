import type { RecommendationFactorBreakdown } from "@/lib/recommendations/scoring";
import type { SupportedLibraryPlatform } from "@/lib/library/types";

export const playTonightActions = [
  "play_this",
  "not_interested",
  "remind_me_later",
  "already_playing",
  "finished_it",
] as const;

export type PlayTonightAction = (typeof playTonightActions)[number];

export interface SessionOption {
  id: string;
  label: string;
  targetSessionMinutes: number;
}

export interface PlayTonightRecommendationCard {
  recommendationId: string;
  gameId: string;
  title: string;
  platform: SupportedLibraryPlatform;
  platformLabel: string;
  coverArtUrl: string;
  coverArtAlt: string;
  estimatedCompletionHours: number;
  recommendationScore: number;
  recommendationReasons: string[];
  explanation: {
    whyThisGame: string[];
    whyNow: string[];
    whyNotSomethingElse: string;
  };
  scoringFactors: RecommendationFactorBreakdown;
}

export interface PlayTonightResponse {
  generatedAt: string;
  sessionOption: SessionOption;
  selectedPlatform?: SupportedLibraryPlatform;
  primaryRecommendation: PlayTonightRecommendationCard;
  alternatives: PlayTonightRecommendationCard[];
  decisionFatigueGuard: {
    maxRecommendations: number;
    shownRecommendations: number;
  };
  coachContext: {
    summary: string;
    keySignals: string[];
  };
  analytics: {
    totalEvents: number;
    impressions: number;
    acceptance: number;
    rejection: number;
    completionOutcomes: number;
  };
}

export interface PlayTonightFeedback {
  userId: string;
  recommendationId: string;
  action: PlayTonightAction;
  gameId?: string;
  platform?: SupportedLibraryPlatform;
  sessionOptionId?: string;
}

export interface PlayTonightAnalyticsEvent {
  type:
    | "recommendation_impression"
    | "recommendation_acceptance"
    | "recommendation_rejection"
    | "recommendation_completion_outcome";
  userId: string;
  recommendationId?: string;
  action?: PlayTonightAction;
  gameId?: string;
  platform?: SupportedLibraryPlatform;
  sessionOptionId?: string;
  createdAt: string;
}
