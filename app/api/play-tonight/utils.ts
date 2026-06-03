import { LibraryValidationError } from "@/lib/library/service";
import { supportedLibraryPlatforms, type SupportedLibraryPlatform } from "@/lib/library/types";

export function getRequiredUserId(url: URL) {
  const userId = url.searchParams.get("userId") ?? "";

  if (!userId.trim()) {
    throw new LibraryValidationError("userId query parameter is required.");
  }

  return userId;
}

export function parsePlatform(url: URL): SupportedLibraryPlatform | undefined {
  const platform = url.searchParams.get("platform");

  if (!platform) {
    return undefined;
  }

  if (supportedLibraryPlatforms.includes(platform as SupportedLibraryPlatform)) {
    return platform as SupportedLibraryPlatform;
  }

  throw new LibraryValidationError(
    `platform must be one of: ${supportedLibraryPlatforms.join(", ")}.`,
  );
}

export function toErrorResponse(error: unknown) {
  if (error instanceof LibraryValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
