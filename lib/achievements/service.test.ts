import assert from "node:assert/strict";
import test from "node:test";

import { AchievementService } from "@/lib/achievements/service";

test("AchievementService stores progress, classifies mastery, and emits analytics/signals", () => {
  const service = new AchievementService();

  service.upsertProgress([
    {
      userId: "user-1",
      canonicalGameId: "game-persona-4-golden",
      platform: "steam",
      totalAchievements: 50,
      unlockedAchievements: 45,
    },
    {
      userId: "user-1",
      canonicalGameId: "game-skyrim",
      platform: "steam",
      totalAchievements: 75,
      unlockedAchievements: 2,
    },
    {
      userId: "user-1",
      canonicalGameId: "game-yakuza-0",
      platform: "steam",
      totalAchievements: 55,
      unlockedAchievements: 55,
    },
    {
      userId: "user-1",
      canonicalGameId: "game-monster-hunter-rise",
      platform: "steam",
      totalAchievements: 0,
      unlockedAchievements: 0,
    },
  ]);

  const progress = service.listForUser("user-1");
  assert.equal(progress.length, 4);
  assert.equal(service.getByGame("user-1", "game-persona-4-golden")?.masteryStatus, "Near Completion");
  assert.equal(service.getByGame("user-1", "game-yakuza-0")?.masteryStatus, "Mastered");
  assert.equal(service.getByGame("user-1", "game-monster-hunter-rise")?.masteryStatus, "Not Started");

  assert.equal(service.getCompleted("user-1").length, 1);
  assert.equal(service.getNearCompletion("user-1").length, 1);
  assert.equal(service.getMastered("user-1").length, 1);

  const completionSignals = service.getCompletionSignals("user-1");
  assert.equal(completionSignals.length, 4);
  assert.equal(completionSignals[0]?.canonicalGameId, "game-yakuza-0");
  assert.ok((completionSignals[0]?.achievementEngagementScore ?? 0) > 0.9);

  const recommendationSignals = service.getRecommendationSignals("user-1");
  assert.equal(recommendationSignals.length, 4);
  assert.equal(recommendationSignals[1]?.canonicalGameId, "game-persona-4-golden");
  assert.equal(recommendationSignals[1]?.nearCompletionBonus, 1);

  const analytics = service.getAnalyticsSummary("user-1");
  assert.equal(analytics.mostCompletedGames.length, 4);
  assert.equal(analytics.masteredGames.length, 1);
  assert.ok(analytics.nearCompletionOpportunities.some((entry) => entry.canonicalGameId === "game-persona-4-golden"));
  assert.ok(
    analytics.franchiseCompletionOpportunities.some((entry) => entry.franchiseId === "fr-yakuza"),
  );
});
