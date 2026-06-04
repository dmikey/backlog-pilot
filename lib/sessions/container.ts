import { getSteamActivityService } from "@/lib/activity/container";
import { SessionFitEngine } from "@/lib/sessions/fit-engine";
import { SessionRecommendationSignals } from "@/lib/sessions/recommendation-signals";
import { SessionIntelligenceService } from "@/lib/sessions/service";
import { getUserLibraryService } from "@/lib/library/container";

export function getSessionIntelligenceService() {
  return new SessionIntelligenceService(
    new SessionFitEngine(),
    new SessionRecommendationSignals(),
    getSteamActivityService(),
    getUserLibraryService(),
  );
}
