import { getSteamActivityService } from "@/lib/activity/container";
import { getAchievementService } from "@/lib/achievements/container";
import { CompletionPredictionEngine } from "@/lib/completion-predictions/engine";
import { getUserLibraryService } from "@/lib/library/container";
import { getSessionIntelligenceService } from "@/lib/sessions/container";

export function getCompletionPredictionEngine() {
  return new CompletionPredictionEngine(
    getUserLibraryService(),
    getSteamActivityService(),
    getAchievementService(),
    getSessionIntelligenceService(),
  );
}

