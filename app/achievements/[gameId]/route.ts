import { getRequiredUserId, toErrorResponse } from "@/app/achievements/utils";
import { getGameById } from "@/lib/demo-data";
import { getAchievementService } from "@/lib/achievements/container";

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = getRequiredUserId(new URL(request.url));
    const { gameId } = await context.params;
    const progress = getAchievementService().getByGame(userId, gameId);

    if (!progress) {
      return Response.json({ error: "Achievement record not found for this game." }, { status: 404 });
    }

    const game = getSafeGame(gameId);

    return Response.json({
      game: game?.canonicalTitle ?? gameId,
      platform: progress.platform,
      totalAchievements: progress.totalAchievements,
      unlockedAchievements: progress.unlockedAchievements,
      completionPercentage: progress.completionPercentage,
      status: progress.masteryStatus,
      canonicalGameId: progress.canonicalGameId,
      updatedAt: progress.updatedAt,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function getSafeGame(gameId: string) {
  try {
    return getGameById(gameId);
  } catch {
    return undefined;
  }
}
