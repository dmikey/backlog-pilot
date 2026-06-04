import { CompletionPredictionValidationError } from "@/lib/completion-predictions/engine";

export function getRequiredUserId(url: URL) {
  const userId = url.searchParams.get("userId") ?? "";
  if (!userId.trim()) {
    throw new CompletionPredictionValidationError("userId query parameter is required.");
  }

  return userId;
}

export function parseTargetSessionMinutes(url: URL) {
  const value = url.searchParams.get("targetSessionMinutes");
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CompletionPredictionValidationError(
      "targetSessionMinutes must be a positive number.",
    );
  }

  return parsed;
}

export function parseLimit(url: URL) {
  const value = url.searchParams.get("limit");
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CompletionPredictionValidationError("limit must be a positive number.");
  }

  return Math.floor(parsed);
}

export function toErrorResponse(error: unknown) {
  if (error instanceof CompletionPredictionValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}

