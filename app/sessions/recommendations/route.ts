import { getSessionIntelligenceService } from "@/lib/sessions/container";

import {
  getRequiredUserId,
  parseAvailableMinutes,
  parseOptionalLimit,
  toErrorResponse,
} from "@/app/sessions/utils";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);

    return Response.json({
      recommendations: getSessionIntelligenceService().getRecommendations({
        userId,
        availableMinutes: parseAvailableMinutes(url),
        limit: parseOptionalLimit(url),
      }),
      analytics: getSessionIntelligenceService().getAnalytics({
        userId,
        availableMinutes: parseAvailableMinutes(url),
      }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
