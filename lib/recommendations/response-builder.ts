import type {
  RankedRecommendationCandidate,
  RecommendationApiResponse,
  RecommendationQueryRequest,
} from "@/lib/recommendations/api-types";

export class RecommendationResponseBuilder {
  build(input: {
    request: Required<Pick<RecommendationQueryRequest, "type">> & {
      filters: NonNullable<RecommendationQueryRequest["filters"]>;
      targetSessionMinutes: number;
      pagination: { page: number; pageSize: number };
    };
    rankedCandidates: RankedRecommendationCandidate[];
    pageCandidates: RankedRecommendationCandidate[];
  }): RecommendationApiResponse {
    const primary = input.pageCandidates[0];
    const alternatives = input.pageCandidates.slice(1);
    const topAlternative = alternatives[0];

    return {
      generatedAt: new Date().toISOString(),
      request: {
        type: input.request.type,
        targetSessionMinutes: input.request.targetSessionMinutes,
        filters: input.request.filters,
        pagination: input.request.pagination,
      },
      primaryRecommendation: primary
        ? this.toRecommendation(primary, {
            title: topAlternative?.title,
            relation: "lower",
            targetSessionMinutes: input.request.targetSessionMinutes,
          })
        : null,
      alternatives: alternatives.map((candidate) =>
        this.toRecommendation(candidate, {
          title: primary?.title,
          relation: "higher",
          targetSessionMinutes: input.request.targetSessionMinutes,
        }),
      ),
      totalCandidates: input.rankedCandidates.length,
    };
  }

  private toRecommendation(
    candidate: RankedRecommendationCandidate,
    input: {
      title?: string;
      relation: "higher" | "lower";
      targetSessionMinutes: number;
    },
  ) {
    const whyThisGame = [
      candidate.reasons[0] ?? "Strong weighted score across recommendation factors.",
      `Estimated ${candidate.estimatedCompletionHours}h to complete.`,
    ];

    const whyNow = [
      `Optimized for ${input.targetSessionMinutes} minute session planning.`,
      candidate.confidence >= 0.8
        ? "Confidence is high based on available gameplay and ownership signals."
        : "Confidence is moderate with room for preference tuning over time.",
    ];

    const whyNotSomethingElse = input.title
      ? input.relation === "higher"
        ? `${input.title} ranked above this option on combined score and session fit.`
        : `${input.title} ranked nearby, but this recommendation scored higher overall.`
      : "No higher-ranked alternative currently beats this recommendation.";

    return {
      recommendationId: candidate.recommendationId,
      gameId: candidate.gameId,
      title: candidate.title,
      platform: candidate.platform,
      score: Math.round(candidate.score),
      confidence: candidate.confidence,
      estimatedCompletionHours: candidate.estimatedCompletionHours,
      reasons: candidate.reasons,
      factorBreakdown: candidate.factors,
      explanation: {
        whyThisGame,
        whyNow,
        whyNotSomethingElse,
      },
    };
  }
}
