import { RetroAchievementsConfigurationError, RetroAchievementsValidationError } from "@/lib/retroachievements/types";

export function getRequiredUserId(url: URL): string {
  const userId = url.searchParams.get("userId") ?? "";

  if (!userId.trim()) {
    throw new RetroAchievementsValidationError("userId query parameter is required.");
  }

  return userId;
}

export function getRequiredRaUsername(url: URL): string {
  const raUsername = url.searchParams.get("raUsername") ?? "";

  if (!raUsername.trim()) {
    throw new RetroAchievementsValidationError("raUsername query parameter is required.");
  }

  return raUsername;
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof RetroAchievementsValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof RetroAchievementsConfigurationError) {
    return Response.json({ error: "RetroAchievements integration is not configured." }, { status: 503 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
