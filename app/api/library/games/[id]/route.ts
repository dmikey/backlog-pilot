import { getUserLibraryService } from "@/lib/library/container";
import { LibraryValidationError } from "@/lib/library/service";
import type { UpdateLibraryGameInput } from "@/lib/library/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = getRequiredUserId(request);
    const { id } = await context.params;
    const body = (await request.json()) as UpdateLibraryGameInput;
    const game = getUserLibraryService().updateGameDetails(userId, id, body);

    return Response.json({ game });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userId = getRequiredUserId(request);
    const { id } = await context.params;
    getUserLibraryService().removeGame(userId, id);

    return new Response(null, { status: 204 });
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

  if (error instanceof SyntaxError) {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}
