import { getSteamServices } from "@/lib/steam/container";
import { SteamConfigurationError, SteamValidationError } from "@/lib/steam/types";

export async function GET(request: Request) {
  try {
    const userId = getRequiredUserId(request);
    return Response.json(getSteamServices().accountService.getConnectionStatus(userId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(request);
    const steamId = url.searchParams.get("steamId")?.trim();
    const account = getSteamServices().accountService.unlinkAccount(userId, steamId);
    return Response.json({ disconnected: true, steamId: account.steamId });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function getRequiredUserId(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId") ?? "";

  if (!userId.trim()) {
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
