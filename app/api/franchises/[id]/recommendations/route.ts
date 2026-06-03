import { getUserLibraryService } from "@/lib/library/container";

import { FranchiseRecommendationSignals } from "@/lib/franchises/recommendation-signals";
import { getRequiredUserId, toErrorResponse } from "@/app/api/franchises/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const { id } = await context.params;
    const service = new FranchiseRecommendationSignals(getUserLibraryService());
    const recommendation = service.getForFranchise(userId, id);

    if (!recommendation) {
      return Response.json({ error: `Franchise "${id}" was not found for this user.` }, { status: 404 });
    }

    return Response.json({ recommendation });
  } catch (error) {
    return toErrorResponse(error);
  }
}
