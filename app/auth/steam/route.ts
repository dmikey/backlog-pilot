import { getSteamServices } from "@/lib/steam/container";
import { SteamConfigurationError, SteamValidationError } from "@/lib/steam/types";

const SESSION_COOKIE_NAME = "steam_link_session";
const SESSION_MAX_AGE_SECONDS = 600;

export async function GET(request: Request) {
  try {
    const userId = getRequiredUserId(request);
    const sessionId = crypto.randomUUID().replaceAll("-", "");
    const { redirectUrl } = getSteamServices().authProvider.beginAuth({ userId, sessionId });

    return new Response(null, {
      status: 302,
      headers: {
        location: redirectUrl,
        "set-cookie": createSessionCookieValue(sessionId),
      },
    });
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

function createSessionCookieValue(sessionId: string) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}; Secure`;
}

function toErrorResponse(error: unknown) {
  if (error instanceof SteamValidationError || error instanceof SteamConfigurationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
