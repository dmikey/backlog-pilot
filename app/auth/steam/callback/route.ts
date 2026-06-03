import { getSteamServices } from "@/lib/steam/container";
import { SteamConfigurationError, SteamValidationError } from "@/lib/steam/types";

const SESSION_COOKIE_NAME = "steam_link_session";

export async function GET(request: Request) {
  try {
    const sessionId = getSessionIdFromCookie(request);
    const callbackParams = new URL(request.url).searchParams;
    const services = getSteamServices();

    const validated = await services.authProvider.validateCallback({
      callbackParams,
      sessionId,
    });

    const profile = await services.identityService.getProfile(validated.steamId);
    const account = services.accountService.linkAccount({
      userId: validated.userId,
      profile,
    });

    return Response.json({ connected: true, account });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function getSessionIdFromCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!match) {
    throw new SteamValidationError("Steam auth session cookie is required.");
  }

  const value = decodeURIComponent(match.split("=").slice(1).join("="));

  if (!value.trim()) {
    throw new SteamValidationError("Steam auth session is invalid.");
  }

  return value;
}

function toErrorResponse(error: unknown) {
  if (error instanceof SteamValidationError || error instanceof SteamConfigurationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
