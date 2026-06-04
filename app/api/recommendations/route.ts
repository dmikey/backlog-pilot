import { getRecommendationApiService } from "@/lib/recommendations/container";

import {
  getRequiredUserId,
  parseFilters,
  parsePagination,
  parseRequestType,
  parseTargetSessionMinutes,
  toErrorResponse,
} from "./utils";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const service = getRecommendationApiService();

    return Response.json(
      service.getRecommendations({
        userId,
        type: parseRequestType(url.searchParams.get("type") ?? undefined),
        targetSessionMinutes: parseTargetSessionMinutes(url),
        filters: parseFilters(url),
        pagination: parsePagination(url),
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
