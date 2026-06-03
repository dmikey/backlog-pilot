import { DuplicateOwnershipService } from "@/lib/duplicates/duplicate-ownership-service";
import { getRequiredUserId, toErrorResponse } from "@/app/api/duplicates/utils";
import { getUserLibraryService } from "@/lib/library/container";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const service = new DuplicateOwnershipService(getUserLibraryService());
    const preferredPlatforms = service.parsePreferredPlatforms(
      url.searchParams.get("preferredPlatforms"),
    );

    return Response.json({ summary: service.getSummary(userId, { preferredPlatforms }) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
