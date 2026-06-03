import { getPlayTonightService } from "@/lib/play-tonight/container";
import { playTonightActions } from "@/lib/play-tonight/types";
import { LibraryValidationError } from "@/lib/library/service";
import { supportedLibraryPlatforms, type SupportedLibraryPlatform } from "@/lib/library/types";

import { toErrorResponse } from "../utils";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      userId?: string;
      recommendationId?: string;
      action?: string;
      gameId?: string;
      platform?: string;
      sessionOptionId?: string;
    };

    const userId = payload.userId?.trim();
    const recommendationId = payload.recommendationId?.trim();

    if (!userId) {
      throw new LibraryValidationError("userId is required.");
    }

    if (!recommendationId) {
      throw new LibraryValidationError("recommendationId is required.");
    }

    if (!payload.action || !playTonightActions.includes(payload.action as (typeof playTonightActions)[number])) {
      throw new LibraryValidationError(
        `action must be one of: ${playTonightActions.join(", ")}.`,
      );
    }

    if (
      payload.platform &&
      !supportedLibraryPlatforms.includes(payload.platform as SupportedLibraryPlatform)
    ) {
      throw new LibraryValidationError(
        `platform must be one of: ${supportedLibraryPlatforms.join(", ")}.`,
      );
    }

    const action = payload.action as (typeof playTonightActions)[number];
    const service = getPlayTonightService();
    const result = service.submitFeedback({
      userId,
      recommendationId,
      action,
      gameId: payload.gameId,
      platform: payload.platform as SupportedLibraryPlatform | undefined,
      sessionOptionId: payload.sessionOptionId,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    return toErrorResponse(error);
  }
}
