import { getSessionIntelligenceService } from "@/lib/sessions/container";
import { SessionValidationError } from "@/lib/sessions/service";

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
        playtimeHours: parseOptionalPlaytimeHours(url.searchParams.get("playtimeHours")),
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

function parseOptionalPlaytimeHours(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new SessionValidationError("playtimeHours must be a non-negative number.");
  }

  return parsed;
}
