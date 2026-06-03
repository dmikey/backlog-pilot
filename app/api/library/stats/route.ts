import { getUserLibraryService } from "@/lib/library/container";
import { LibraryValidationError } from "@/lib/library/service";

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get("userId") ?? "";

    if (!userId.trim()) {
      throw new LibraryValidationError("userId query parameter is required.");
    }

    return Response.json({ stats: getUserLibraryService().getStats(userId) });
  } catch (error) {
    if (error instanceof LibraryValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
