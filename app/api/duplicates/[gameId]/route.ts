import { DuplicateOwnershipService } from "@/lib/duplicates/duplicate-ownership-service";
import { getRequiredUserId, toErrorResponse, toPlatformLabel } from "@/app/api/duplicates/utils";
import { getUserLibraryService } from "@/lib/library/container";

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const url = new URL(request.url);
    const userId = getRequiredUserId(url);
    const { gameId } = await context.params;
    const service = new DuplicateOwnershipService(getUserLibraryService());
    const preferredPlatforms = service.parsePreferredPlatforms(
      url.searchParams.get("preferredPlatforms"),
    );
    const group = service.getGroupByCanonicalGameId(userId, gameId, { preferredPlatforms });

    if (!group) {
      return Response.json({ error: "Duplicate group not found for this game." }, { status: 404 });
    }

    return Response.json({
      canonicalGameId: gameId,
      ownershipCount: group.duplicateCount,
      platforms: group.platforms.map((platform) => toPlatformLabel(platform)),
      preferredPlatform: toPlatformLabel(group.preferredPlatform),
      group,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
