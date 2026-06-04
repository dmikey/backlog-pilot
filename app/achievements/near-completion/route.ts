import { getRequiredUserId, toErrorResponse } from "@/app/achievements/utils";
import { getAchievementService } from "@/lib/achievements/container";

export async function GET(request: Request) {
  try {
    const userId = getRequiredUserId(new URL(request.url));

    return Response.json({
      games: getAchievementService().getNearCompletion(userId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
