import { getUserLibraryService } from "@/lib/library/container";

import { FranchiseProgressService } from "@/lib/franchises/franchise-progress-service";
import { getRequiredUserId, toErrorResponse } from "@/app/api/franchises/utils";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const service = new FranchiseProgressService(getUserLibraryService());

    return Response.json(service.getSnapshot(userId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
