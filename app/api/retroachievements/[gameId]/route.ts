import { getRetroAchievementService } from "@/lib/retroachievements/container";
import { getRequiredUserId, toErrorResponse } from "@/app/api/retroachievements/utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const { gameId } = await params;
    const service = getRetroAchievementService();

    const progress = service.getProgress(userId);
    const entry = progress.find((p) => p.canonicalGameId === gameId || p.retroAchievementsGameId === Number(gameId));

    if (!entry) {
      return Response.json({ error: "Game progress not found." }, { status: 404 });
    }

    return Response.json({
      game: entry.gameTitle,
      platform: entry.platform,
      completionPercentage: entry.completionPercentage,
      masteryStatus: entry.masteryStatus,
      hardcoreCompletionPercentage: entry.hardcoreCompletionPercentage,
      totalAchievements: entry.totalAchievements,
      unlockedAchievements: entry.unlockedAchievements,
      hardcoreUnlockedAchievements: entry.hardcoreUnlockedAchievements,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
