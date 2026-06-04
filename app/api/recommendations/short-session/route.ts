import { getRecommendationApiService } from "@/lib/recommendations/container";

import {
  getRequiredUserId,
  parseFilters,
  parsePagination,
  toErrorResponse,
} from "../utils";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    return Response.json(
      getRecommendationApiService().getRecommendations({
        userId: getRequiredUserId(url),
        type: "short-session",
        filters: parseFilters(url),
        pagination: parsePagination(url),
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
