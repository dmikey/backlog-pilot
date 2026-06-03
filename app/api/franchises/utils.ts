import { LibraryValidationError } from "@/lib/library/service";

export function getRequiredUserId(url: URL) {
  const userId = url.searchParams.get("userId") ?? "";

  if (!userId.trim()) {
    throw new LibraryValidationError("userId query parameter is required.");
  }

  return userId;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof LibraryValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
