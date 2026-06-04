import { getUserLibraryService } from "@/lib/library/container";
import { getAchievementService } from "@/lib/achievements/container";
import { getSteamActivityService } from "@/lib/activity/container";
import { RecommendationApiService } from "@/lib/recommendations/api-service";
import { RecommendationQueryService } from "@/lib/recommendations/query-service";
import { RecommendationResponseBuilder } from "@/lib/recommendations/response-builder";

export function getRecommendationApiService() {
  return new RecommendationApiService(
    new RecommendationQueryService(
      getUserLibraryService(),
      getSteamActivityService(),
      getAchievementService(),
    ),
    new RecommendationResponseBuilder(),
  );
}
