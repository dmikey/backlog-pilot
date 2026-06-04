import { getAchievementService } from "@/lib/achievements/container";
import { getRetroAchievementsConfigFromEnv } from "@/lib/retroachievements/config";
import { RetroMasteryEngine } from "@/lib/retroachievements/mastery-engine";
import { RetroAchievementsProvider } from "@/lib/retroachievements/provider";
import { RetroAchievementService } from "@/lib/retroachievements/service";

let service: RetroAchievementService | undefined;

export function getRetroAchievementService(): RetroAchievementService {
  if (!service) {
    service = createService();
  }

  return service;
}

export function resetRetroAchievementServiceForTests(overrides?: {
  fetchImpl?: typeof fetch;
  canonicalGameResolver?: (retroGameId: number, gameTitle: string) => string | undefined;
}) {
  service = createService(overrides);
}

function createService(overrides?: {
  fetchImpl?: typeof fetch;
  canonicalGameResolver?: (retroGameId: number, gameTitle: string) => string | undefined;
}) {
  const config = getRetroAchievementsConfigFromEnv();
  const provider = new RetroAchievementsProvider({
    config,
    fetchImpl: overrides?.fetchImpl,
  });

  return new RetroAchievementService({
    provider,
    achievementService: getAchievementService(),
    masteryEngine: new RetroMasteryEngine(),
    canonicalGameResolver: overrides?.canonicalGameResolver,
  });
}
