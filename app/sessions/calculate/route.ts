import { getSessionIntelligenceService } from "@/lib/sessions/container";
import { SessionValidationError } from "@/lib/sessions/service";

import { toErrorResponse } from "@/app/sessions/utils";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      gameId?: string;
      availableMinutes?: number;
      playtimeHours?: number;
    };

    if (!body.gameId?.trim()) {
      throw new SessionValidationError("gameId is required.");
    }

    return Response.json(
      getSessionIntelligenceService().calculateSessionFit({
        gameId: body.gameId,
        availableMinutes: body.availableMinutes ?? 60,
        playtimeHours: body.playtimeHours,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
