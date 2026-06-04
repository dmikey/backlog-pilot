import type { RecommendationFactorBreakdown } from "@/lib/recommendations/scoring";
import type {
  GameStatus,
  OwnershipType,
  SupportedLibraryPlatform,
} from "@/lib/library/types";

export const recommendationRequestTypes = [
  "play-tonight",
  "continue-franchise",
  "short-session",
  "long-session",
  "backlog-reduction",
  "custom",
] as const;

export type RecommendationRequestType = (typeof recommendationRequestTypes)[number];

export interface RecommendationFilters {
  platform?: SupportedLibraryPlatform;
  genre?: string;
  franchiseId?: string;
  minEstimatedHours?: number;
  maxEstimatedHours?: number;
  status?: GameStatus[];
  ownershipType?: OwnershipType;
}

export interface RecommendationPagination {
  page: number;
  pageSize: number;
}

export interface RecommendationQueryRequest {
  userId: string;
  type?: RecommendationRequestType;
  targetSessionMinutes?: number;
  filters?: RecommendationFilters;
  pagination?: Partial<RecommendationPagination>;
}

export interface RecommendationCandidateResponse {
  recommendationId: string;
  gameId: string;
  title: string;
  platform: SupportedLibraryPlatform;
  score: number;
  confidence: number;
  estimatedCompletionHours: number;
  reasons: string[];
  factorBreakdown: RecommendationFactorBreakdown;
  explanation: {
    whyThisGame: string[];
    whyNow: string[];
    whyNotSomethingElse: string;
  };
}

export interface RecommendationApiResponse {
  generatedAt: string;
  request: {
    type: RecommendationRequestType;
    targetSessionMinutes: number;
    filters: RecommendationFilters;
    pagination: RecommendationPagination;
  };
  primaryRecommendation: RecommendationCandidateResponse | null;
  alternatives: RecommendationCandidateResponse[];
  totalCandidates: number;
}

export interface RankedRecommendationCandidate {
  recommendationId: string;
  gameId: string;
  title: string;
  platform: SupportedLibraryPlatform;
  score: number;
  confidence: number;
  estimatedCompletionHours: number;
  reasons: string[];
  factors: RecommendationFactorBreakdown;
}
