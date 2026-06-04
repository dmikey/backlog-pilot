import { getRequiredUserId, toErrorResponse } from "@/app/activity/utils";
import { getSteamActivityService } from "@/lib/activity/container";

export async function GET(request: Request) {
  try {
    const userId = getRequiredUserId(new URL(request.url));
    const service = getSteamActivityService();

    return Response.json({
      activity: service.listForUser(userId),
      analytics: service.getAnalyticsSummary(userId),
      recommendationSignals: service.getRecommendationSignals(userId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
