import assert from "node:assert/strict";
import test from "node:test";

import { CompletionSignalEngine } from "@/lib/achievements/completion-signal-engine";

test("CompletionSignalEngine calculates completion percentage and mastery status", () => {
  const engine = new CompletionSignalEngine();

  assert.equal(engine.toCompletionPercentage(50, 45), 90);
  assert.equal(engine.toMasteryStatus(50, 90), "Near Completion");
  assert.equal(engine.toMasteryStatus(50, 100), "Mastered");
  assert.equal(engine.toMasteryStatus(10, 100), "Completed");
  assert.equal(engine.toMasteryStatus(75, 3), "In Progress");
  assert.equal(engine.toMasteryStatus(0, 0), "Not Started");
});

test("CompletionSignalEngine generates completion and recommendation signals", () => {
  const engine = new CompletionSignalEngine();
  const completion = engine.toCompletionSignal(
    {
      userId: "user-1",
      canonicalGameId: "game-persona-4-golden",
      platform: "steam",
      totalAchievements: 50,
      unlockedAchievements: 45,
      completionPercentage: 90,
      masteryStatus: "Near Completion",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    0.92,
  );

  assert.equal(completion.completionCandidate, true);
  assert.equal(completion.masteryCandidate, true);
  assert.equal(completion.franchiseMomentum, 0.92);
  assert.ok(completion.achievementEngagementScore > 0.8);

  const recommendation = engine.toRecommendationSignal(
    {
      userId: "user-1",
      canonicalGameId: "game-persona-4-golden",
      platform: "steam",
      totalAchievements: 50,
      unlockedAchievements: 45,
      completionPercentage: 90,
      masteryStatus: "Near Completion",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    completion,
  );

  assert.equal(recommendation.nearCompletionBonus, 1);
  assert.equal(recommendation.masteryOpportunityBonus, 1);
  assert.ok(recommendation.achievementMomentumBonus > 0.8);
  assert.ok(recommendation.abandonmentRiskScore >= 0);
});
