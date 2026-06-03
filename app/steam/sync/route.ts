import { getSteamServices } from "@/lib/steam/container";
import { SteamConfigurationError, SteamValidationError } from "@/lib/steam/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string };
    const userId = getRequiredUserId(body.userId);
    const result = await getSteamServices().syncJob.runManualSync(userId);

    return Response.json(
      {
        gamesImported: result.gamesImported,
        gamesMatched: result.gamesMatched,
        gamesUnmatched: result.gamesUnmatched,
        durationMs: result.durationMs ?? 0,
        newAcquisitions: result.newAcquisitions,
        removedTitles: result.removedTitles,
        updatedGames: result.updatedGames,
      },
      { status: 200 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

function getRequiredUserId(userId: string | undefined) {
  if (!userId?.trim()) {
    throw new SteamValidationError("userId is required.");
  }

  return userId;
}

function toErrorResponse(error: unknown) {
  if (error instanceof SteamValidationError || error instanceof SteamConfigurationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof SyntaxError) {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
