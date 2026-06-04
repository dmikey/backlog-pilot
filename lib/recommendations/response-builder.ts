import type {
  RankedRecommendationCandidate,
  RecommendationApiResponse,
  RecommendationQueryRequest,
} from "@/lib/recommendations/api-types";
import {
  ExplanationResponseBuilder,
  RecommendationExplanationService,
  toRecommendationExplanationUseCase,
} from "@/lib/recommendations/explanations";

export class RecommendationResponseBuilder {
  private readonly explanationService = new RecommendationExplanationService();
  private readonly explanationResponseBuilder = new ExplanationResponseBuilder();

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
            requestType: input.request.type,
          })
        : null,
      alternatives: alternatives.map((candidate) =>
        this.toRecommendation(candidate, {
          title: primary?.title,
          relation: "higher",
          requestType: input.request.type,
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
      requestType: RecommendationQueryRequest["type"];
    },
  ) {
    const explanationResult = this.explanationService.generate({
      useCase: toRecommendationExplanationUseCase(input.requestType),
      signals: candidate.explanationInput,
    });
    const explanation = this.explanationResponseBuilder.build({
      result: explanationResult,
      alternativeTitle: input.title,
      relation: input.relation,
    });

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
      explanation,
    };
  }
}
