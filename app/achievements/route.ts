import { getRequiredUserId, toErrorResponse } from "@/app/achievements/utils";
import { getAchievementService } from "@/lib/achievements/container";

export async function GET(request: Request) {
  try {
    const userId = getRequiredUserId(new URL(request.url));
    const service = getAchievementService();

    return Response.json({
      achievements: service.listForUser(userId),
      completionSignals: service.getCompletionSignals(userId),
      recommendationSignals: service.getRecommendationSignals(userId),
      analytics: service.getAnalyticsSummary(userId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
