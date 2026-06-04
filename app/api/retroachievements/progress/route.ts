import { getRetroAchievementService } from "@/lib/retroachievements/container";
import { getRequiredUserId, toErrorResponse } from "@/app/api/retroachievements/utils";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const service = getRetroAchievementService();

    return Response.json({
      progress: service.getProgress(userId),
      analytics: service.getAnalytics(userId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
