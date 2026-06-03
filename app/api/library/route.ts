import { getUserLibraryService } from "@/lib/library/container";
import { LibraryValidationError } from "@/lib/library/service";

export async function GET(request: Request) {
  try {
    const userId = getRequiredUserId(request);
    const service = getUserLibraryService();
    const library = service.getLibrary(userId) ?? service.createLibrary(userId);
    return Response.json({ library });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function getRequiredUserId(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId") ?? "";

  if (!userId.trim()) {
    throw new LibraryValidationError("userId query parameter is required.");
  }

  return userId;
}

function toErrorResponse(error: unknown) {
  if (error instanceof LibraryValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
