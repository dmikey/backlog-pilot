import {
  type RecommendationApiResponse,
  type RecommendationQueryRequest,
  type RecommendationRequestType,
} from "@/lib/recommendations/api-types";
import { RecommendationQueryService } from "@/lib/recommendations/query-service";
import { RecommendationResponseBuilder } from "@/lib/recommendations/response-builder";

const defaultPageSize = 4;
const maxPageSize = 50;

const typeDefaults: Record<RecommendationRequestType, { targetSessionMinutes: number }> = {
  "play-tonight": { targetSessionMinutes: 60 },
  "continue-franchise": { targetSessionMinutes: 90 },
  "short-session": { targetSessionMinutes: 30 },
  "long-session": { targetSessionMinutes: 240 },
  "backlog-reduction": { targetSessionMinutes: 60 },
  custom: { targetSessionMinutes: 60 },
};

export class RecommendationApiService {
  constructor(
    private readonly queryService: RecommendationQueryService,
    private readonly responseBuilder: RecommendationResponseBuilder,
  ) {}

  getRecommendations(request: RecommendationQueryRequest): RecommendationApiResponse {
    const normalized = this.normalizeRequest(request);

    const ranked = this.queryService.query({
      userId: normalized.userId,
      targetSessionMinutes: normalized.targetSessionMinutes,
      filters: normalized.filters,
    });

    const start = (normalized.pagination.page - 1) * normalized.pagination.pageSize;
    const end = start + normalized.pagination.pageSize;
    const pageCandidates = ranked.slice(start, end);

    return this.responseBuilder.build({
      request: {
        type: normalized.type,
        filters: normalized.filters,
        targetSessionMinutes: normalized.targetSessionMinutes,
        pagination: normalized.pagination,
      },
      rankedCandidates: ranked,
      pageCandidates,
    });
  }

  private normalizeRequest(request: RecommendationQueryRequest) {
    const type = request.type ?? "play-tonight";
    const defaults = typeDefaults[type];
    const targetSessionMinutes = request.targetSessionMinutes ?? defaults.targetSessionMinutes;

    const filters = {
      ...(request.filters ?? {}),
    };

    if (type === "backlog-reduction" && !filters.status?.length) {
      filters.status = ["Unplayed"];
    }

    if (type === "continue-franchise" && filters.franchiseId) {
      filters.status = filters.status?.length ? filters.status : ["Unplayed", "Active"];
    }

    if (type === "short-session" && filters.maxEstimatedHours === undefined) {
      filters.maxEstimatedHours = 35;
    }

    if (type === "long-session" && filters.minEstimatedHours === undefined) {
      filters.minEstimatedHours = 35;
    }

    const page = Math.max(1, request.pagination?.page ?? 1);
    const pageSize = Math.min(
      maxPageSize,
      Math.max(1, request.pagination?.pageSize ?? defaultPageSize),
    );

    return {
      userId: request.userId,
      type,
      targetSessionMinutes,
      filters,
      pagination: {
        page,
        pageSize,
      },
    };
  }
}
