import { getUserLibraryService } from "@/lib/library/container";
import { LibraryValidationError } from "@/lib/library/service";
import type { AddLibraryGameInput, ListGamesFilters } from "@/lib/library/types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const service = getUserLibraryService();

    const query = url.searchParams.get("q")?.trim();

    if (query) {
      return Response.json({ games: service.searchGames(userId, query) });
    }

    const filters: ListGamesFilters = {};
    const status = url.searchParams.get("status");
    const platform = url.searchParams.get("platform");

    if (status) {
      filters.status = status as ListGamesFilters["status"];
    }

    if (platform) {
      filters.platform = platform as ListGamesFilters["platform"];
    }

    return Response.json({ games: service.listGames(userId, filters) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AddLibraryGameInput;
    const game = getUserLibraryService().addGame(body);
    return Response.json({ game }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function getRequiredUserId(url: URL) {
  const userId = url.searchParams.get("userId") ?? "";

  if (!userId.trim()) {
    throw new LibraryValidationError("userId query parameter is required.");
  }

  return userId;
}

function toErrorResponse(error: unknown) {
  if (error instanceof LibraryValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof SyntaxError) {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
