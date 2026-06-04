import { ActivityValidationError } from "@/lib/activity/service";

export function getRequiredUserId(url: URL) {
  const userId = url.searchParams.get("userId") ?? "";

  if (!userId.trim()) {
    throw new ActivityValidationError("userId query parameter is required.");
  }

  return userId;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ActivityValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
