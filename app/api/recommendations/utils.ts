import { LibraryValidationError } from "@/lib/library/service";
import {
  gameStatuses,
  ownershipTypes,
  supportedLibraryPlatforms,
  type GameStatus,
  type OwnershipType,
  type SupportedLibraryPlatform,
} from "@/lib/library/types";
import {
  recommendationRequestTypes,
  type RecommendationFilters,
  type RecommendationRequestType,
} from "@/lib/recommendations/api-types";

export function getRequiredUserId(url: URL) {
  const userId = url.searchParams.get("userId") ?? "";

  if (!userId.trim()) {
    throw new LibraryValidationError("userId query parameter is required.");
  }

  return userId;
}

export function parseRequestType(value?: string): RecommendationRequestType | undefined {
  if (!value) {
    return undefined;
  }

  if (recommendationRequestTypes.includes(value as RecommendationRequestType)) {
    return value as RecommendationRequestType;
  }

  throw new LibraryValidationError(
    `type must be one of: ${recommendationRequestTypes.join(", ")}.`,
  );
}

export function parseFilters(url: URL): RecommendationFilters {
  const filters: RecommendationFilters = {};

  const platform = url.searchParams.get("platform");
  if (platform) {
    filters.platform = parsePlatform(platform);
  }

  const genre = url.searchParams.get("genre");
  if (genre) {
    filters.genre = genre;
  }

  const franchiseId = url.searchParams.get("franchise");
  if (franchiseId) {
    filters.franchiseId = franchiseId;
  }

  const minEstimatedHours = parseNumberParam(url, "minEstimatedHours");
  if (minEstimatedHours !== undefined) {
    filters.minEstimatedHours = minEstimatedHours;
  }

  const maxEstimatedHours = parseNumberParam(url, "maxEstimatedHours");
  if (maxEstimatedHours !== undefined) {
    filters.maxEstimatedHours = maxEstimatedHours;
  }

  const ownershipType = url.searchParams.get("ownershipType");
  if (ownershipType) {
    filters.ownershipType = parseOwnershipType(ownershipType);
  }

  const status = url.searchParams.get("status");
  if (status) {
    filters.status = status
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => parseStatus(value));
  }

  if (
    filters.minEstimatedHours !== undefined &&
    filters.maxEstimatedHours !== undefined &&
    filters.minEstimatedHours > filters.maxEstimatedHours
  ) {
    throw new LibraryValidationError(
      "minEstimatedHours cannot be greater than maxEstimatedHours.",
    );
  }

  return filters;
}

export function parsePagination(url: URL) {
  return {
    page: parseNumberParam(url, "page"),
    pageSize: parseNumberParam(url, "pageSize"),
  };
}

export function parseTargetSessionMinutes(url: URL) {
  return parseNumberParam(url, "targetSessionMinutes");
}

export function toErrorResponse(error: unknown) {
  if (error instanceof LibraryValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
}

function parseNumberParam(url: URL, key: string) {
  const value = url.searchParams.get(key);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new LibraryValidationError(`${key} must be a non-negative number.`);
  }

  return parsed;
}

export function parsePlatform(value: string): SupportedLibraryPlatform {
  if (supportedLibraryPlatforms.includes(value as SupportedLibraryPlatform)) {
    return value as SupportedLibraryPlatform;
  }

  throw new LibraryValidationError(
    `platform must be one of: ${supportedLibraryPlatforms.join(", ")}.`,
  );
}

export function parseOwnershipType(value: string): OwnershipType {
  if (ownershipTypes.includes(value as OwnershipType)) {
    return value as OwnershipType;
  }

  throw new LibraryValidationError(
    `ownershipType must be one of: ${ownershipTypes.join(", ")}.`,
  );
}

export function parseStatus(value: string): GameStatus {
  if (gameStatuses.includes(value as GameStatus)) {
    return value as GameStatus;
  }

  throw new LibraryValidationError(`status must be one of: ${gameStatuses.join(", ")}.`);
}
