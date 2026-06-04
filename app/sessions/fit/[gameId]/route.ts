import { getSessionIntelligenceService } from "@/lib/sessions/container";

import {
  parseAvailableMinutes,
  toErrorResponse,
} from "@/app/sessions/utils";

export async function GET(
  request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await context.params;
    const url = new URL(request.url);

    return Response.json(
      getSessionIntelligenceService().calculateSessionFit({
        gameId,
        availableMinutes: parseAvailableMinutes(url),
        playtimeHours: Number(url.searchParams.get("playtimeHours") ?? 0) || 0,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
