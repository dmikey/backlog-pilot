import { getRetroAchievementService } from "@/lib/retroachievements/container";
import { getRequiredRaUsername, getRequiredUserId, toErrorResponse } from "@/app/api/retroachievements/utils";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const raUsername = getRequiredRaUsername(url);
    const service = getRetroAchievementService();
    const result = await service.syncUser(userId, raUsername);

    return Response.json({
      userId: result.userId,
      raUsername: result.username,
      profile: result.profile,
      syncedGames: result.syncedGames,
      skippedGames: result.skippedGames,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
