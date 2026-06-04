import { getUserLibraryService } from "@/lib/library/container";
import { getAchievementService } from "@/lib/achievements/container";
import { RecommendationApiService } from "@/lib/recommendations/api-service";
import { RecommendationQueryService } from "@/lib/recommendations/query-service";
import { RecommendationResponseBuilder } from "@/lib/recommendations/response-builder";

export function getRecommendationApiService() {
  return new RecommendationApiService(
    new RecommendationQueryService(getUserLibraryService(), undefined, getAchievementService()),
    new RecommendationResponseBuilder(),
  );
}
