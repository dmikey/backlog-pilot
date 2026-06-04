import { getRequiredUserId, toErrorResponse } from "@/app/activity/utils";
import { getSteamActivityService } from "@/lib/activity/container";

export async function GET(request: Request) {
  try {
    const userId = getRequiredUserId(new URL(request.url));

    return Response.json({
      games: getSteamActivityService().getRecent(userId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
