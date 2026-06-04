import { LibraryValidationError } from "@/lib/library/service";
import { getRecommendationApiService } from "@/lib/recommendations/container";

import {
  parseOwnershipType,
  parsePlatform,
  parseRequestType,
  parseStatus,
  toErrorResponse,
} from "../utils";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      userId?: string;
      type?: string;
      targetSessionMinutes?: number;
      filters?: {
        platform?: string;
        genre?: string;
        franchiseId?: string;
        minEstimatedHours?: number;
        maxEstimatedHours?: number;
        status?: string[];
        ownershipType?: string;
      };
      pagination?: {
        page?: number;
        pageSize?: number;
      };
    };

    const userId = payload.userId?.trim();

    if (!userId) {
      throw new LibraryValidationError("userId is required.");
    }

    const service = getRecommendationApiService();
    const status = payload.filters?.status?.map((value) => parseStatus(value));
    const platform = payload.filters?.platform
      ? parsePlatform(payload.filters.platform)
      : undefined;
    const ownershipType = payload.filters?.ownershipType
      ? parseOwnershipType(payload.filters.ownershipType)
      : undefined;

    return Response.json(
      service.getRecommendations({
        userId,
        type: parseRequestType(payload.type),
        targetSessionMinutes: payload.targetSessionMinutes,
        filters: payload.filters
          ? {
              ...payload.filters,
              platform,
              status,
              ownershipType,
            }
          : undefined,
        pagination: payload.pagination,
      }),
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    return toErrorResponse(error);
  }
}
