import { SessionValidationError } from "@/lib/sessions/service";

export function getRequiredUserId(url: URL) {
  const userId = url.searchParams.get("userId") ?? "";

  if (!userId.trim()) {
    throw new SessionValidationError("userId query parameter is required.");
  }

  return userId;
}

export function parseAvailableMinutes(url: URL, fallback = 60) {
  const value = url.searchParams.get("availableMinutes");

  if (!value) {
    return fallback;
  }

  const minutes = Number(value);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new SessionValidationError("availableMinutes must be a positive number.");
  }

  return minutes;
}

export function parseOptionalLimit(url: URL, fallback = 10) {
  const value = url.searchParams.get("limit");

  if (!value) {
    return fallback;
  }

  const limit = Number(value);

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new SessionValidationError("limit must be a positive number.");
  }

  return limit;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof SessionValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
