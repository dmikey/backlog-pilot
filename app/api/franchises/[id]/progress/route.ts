import { getUserLibraryService } from "@/lib/library/container";

import { FranchiseProgressService } from "@/lib/franchises/franchise-progress-service";
import { getRequiredUserId, toErrorResponse } from "@/app/api/franchises/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const { id } = await context.params;
    const service = new FranchiseProgressService(getUserLibraryService());
    const progress = service.getByFranchiseId(userId, id);

    if (!progress) {
      return Response.json({ error: `Franchise "${id}" was not found for this user.` }, { status: 404 });
    }

    return Response.json({ progress });
  } catch (error) {
    return toErrorResponse(error);
  }
}
