import { getSteamServices } from "@/lib/steam/container";
import { SteamConfigurationError, SteamValidationError } from "@/lib/steam/types";

export async function GET(request: Request) {
  try {
    const userId = getRequiredUserId(new URL(request.url).searchParams.get("userId"));
    const library = getSteamServices().syncService.getSteamLibrary(userId);
    return Response.json(library);
  } catch (error) {
    return toErrorResponse(error);
  }
}

function getRequiredUserId(userId: string | null) {
  if (!userId?.trim()) {
    throw new SteamValidationError("userId query parameter is required.");
  }

  return userId;
}

function toErrorResponse(error: unknown) {
  if (error instanceof SteamValidationError || error instanceof SteamConfigurationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
