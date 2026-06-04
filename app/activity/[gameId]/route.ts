import { getRequiredUserId, toErrorResponse } from "@/app/activity/utils";
import { getSteamActivityService } from "@/lib/activity/container";

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = getRequiredUserId(new URL(request.url));
    const { gameId } = await context.params;
    const activity = getSteamActivityService().getByGame(userId, gameId);

    if (!activity) {
      return Response.json({ error: "Activity record not found for this game." }, { status: 404 });
    }

    return Response.json(activity);
  } catch (error) {
    return toErrorResponse(error);
  }
}
