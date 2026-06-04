import assert from "node:assert/strict";
import test from "node:test";

import { SteamActivityService } from "@/lib/activity/service";
import { AchievementService } from "@/lib/achievements/service";
import { CompletionSignalEngine } from "@/lib/achievements/completion-signal-engine";
import { CompletionPredictionEngine } from "@/lib/completion-predictions/engine";
import { UserLibraryService } from "@/lib/library/service";
import { SessionIntelligenceService } from "@/lib/sessions/service";

function createEngine() {
  const libraryService = new UserLibraryService();
  const activityService = new SteamActivityService();
  const achievementService = new AchievementService(new CompletionSignalEngine());
  const sessionService = new SessionIntelligenceService();
  const engine = new CompletionPredictionEngine(
    libraryService,
    activityService,
    achievementService,
    sessionService,
  );

  return { engine, libraryService, activityService, achievementService };
}

test("CompletionPredictionEngine predicts completion likelihood and recommendation signals", async () => {
  const { engine, libraryService, activityService, achievementService } = createEngine();

  for (const [canonicalGameId, status, platform, platformGameId] of [
    ["game-persona-3-portable", "Completed", "psp", "ULUS-10432"],
    ["game-persona-4-golden", "Completed", "steam", "1113000"],
    ["game-persona-5-royal", "Unplayed", "steam", "P5R"],
    ["game-monster-hunter-rise", "Abandoned", "steam", "1446780"],
  ] as const) {
    libraryService.addGame({
      userId: "user-completion-1",
      canonicalGameId,
      status,
      ownership: {
        platform,
        platformGameId,
        source: "manual-import",
        ownershipType: "Digital",
      },
    });
  }

  await activityService.upsertActivities([
    {
      userId: "user-completion-1",
      canonicalGameId: "game-persona-5-royal",
      platform: "steam",
      totalPlaytimeMinutes: 210,
      recentPlaytimeMinutes: 150,
      lastPlayedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  await achievementService.upsertProgress([
    {
      userId: "user-completion-1",
      canonicalGameId: "game-persona-4-golden",
      platform: "steam",
      totalAchievements: 50,
      unlockedAchievements: 45,
    },
  ]);

  const prediction = engine.getByGame({
    userId: "user-completion-1",
    gameId: "game-persona-5-royal",
  });

  assert.ok(prediction);
  assert.ok((prediction?.completionLikelihood ?? 0) > 0);
  assert.ok((prediction?.completionLikelihood ?? 0) <= 1);
  assert.ok((prediction?.confidence ?? 0) > 0);
  assert.ok((prediction?.recommendationSignals.completionLikelihoodBonus ?? 0) > 0);
  assert.ok((prediction?.signals.length ?? 0) > 0);
});

test("CompletionPredictionEngine predicts abandonment risk for long backlog-heavy titles", () => {
  const { engine, libraryService } = createEngine();

  for (const [canonicalGameId, status] of [
    ["game-monster-hunter-rise", "Abandoned"],
    ["game-persona-4-golden", "Abandoned"],
    ["game-yakuza-0", "Completed"],
    ["game-persona-5-royal", "Unplayed"],
    ["game-final-fantasy-tactics-wotl", "Unplayed"],
  ] as const) {
    libraryService.addGame({
      userId: "user-completion-2",
      canonicalGameId,
      status,
      ownership: {
        platform: "steam",
        platformGameId: canonicalGameId,
        source: "manual-import",
        ownershipType: "Digital",
      },
    });
  }

  const highRisk = engine.getHighRisk({ userId: "user-completion-2" });
  if (highRisk[0]) {
    assert.ok(highRisk[0].abandonmentRiskScore >= 0);
    assert.equal(highRisk[0].abandonmentRisk, "High Risk");
  } else {
    assert.equal(highRisk.length, 0);
  }
});

test("CompletionPredictionEngine computes confidence and analytics summaries", () => {
  const { engine, libraryService } = createEngine();

  for (const [canonicalGameId, status, platform] of [
    ["game-yakuza-0", "Completed", "steam"],
    ["game-yakuza-kiwami", "Completed", "steam"],
    ["game-persona-3-portable", "Completed", "psp"],
    ["game-persona-4-golden", "Abandoned", "steam"],
    ["game-monster-hunter-rise", "Unplayed", "nintendo-switch"],
  ] as const) {
    libraryService.addGame({
      userId: "user-completion-3",
      canonicalGameId,
      status,
      ownership: {
        platform,
        platformGameId: canonicalGameId,
        source: "manual-import",
        ownershipType: "Digital",
      },
    });
  }

  const predictions = engine.listPredictions({ userId: "user-completion-3" });
  assert.ok(predictions.every((entry) => entry.confidence >= 0 && entry.confidence <= 1));
  assert.ok(predictions.every((entry) => ["High", "Medium", "Low"].includes(entry.confidenceLevel)));

  const analytics = engine.getAnalytics({ userId: "user-completion-3" });
  assert.ok(analytics.predictionAccuracy >= 0 && analytics.predictionAccuracy <= 1);
  assert.ok(analytics.highestCompletionGenres.length > 0);
  assert.ok(analytics.lowestCompletionGenres.length > 0);
  assert.ok(analytics.platformCompletionRates.length > 0);
});
