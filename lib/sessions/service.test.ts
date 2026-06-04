import assert from "node:assert/strict";
import test from "node:test";

import { SessionFitEngine } from "@/lib/sessions/fit-engine";
import { SessionRecommendationSignals } from "@/lib/sessions/recommendation-signals";
import { SessionIntelligenceService } from "@/lib/sessions/service";

test("SessionFitEngine classifies games into session profiles and scores fit", () => {
  const engine = new SessionFitEngine();

  const microProfile = engine.classify({
    gameId: "game-a",
    externalIds: {},
    aliasMatchKeys: [],
    editionMatchKeys: [],
    duplicateDetectionKey: "a",
    completionTimeHours: { main: 6 },
    estimatedHours: 6,
    completionLikelihood: "high",
    mood: "quick",
  });

  const marathonProfile = engine.classify({
    gameId: "game-b",
    externalIds: {},
    aliasMatchKeys: [],
    editionMatchKeys: [],
    duplicateDetectionKey: "b",
    completionTimeHours: { main: 120 },
    estimatedHours: 140,
    completionLikelihood: "low",
    mood: "epic",
  });

  assert.equal(microProfile.primaryCategory, "Micro Session");
  assert.equal(marathonProfile.primaryCategory, "Marathon Session");

  const fit = engine.evaluate({
    metadata: {
      gameId: "game-c",
      externalIds: {},
      aliasMatchKeys: [],
      editionMatchKeys: [],
      duplicateDetectionKey: "c",
      completionTimeHours: { main: 30 },
      estimatedHours: 30,
      completionLikelihood: "medium",
      mood: "balanced",
      genreWeights: { "genre-rpg": 0.8 },
    },
    availableMinutes: 60,
    playtimeHours: 4,
  });

  assert.ok(fit.sessionFitScore >= 0);
  assert.ok(fit.sessionFitScore <= 1);
  assert.ok(fit.progressOpportunityScore >= 0);
  assert.ok(fit.progressOpportunityScore <= 1);
  assert.ok(fit.sessionSatisfactionScore >= 0);
  assert.ok(fit.sessionSatisfactionScore <= 1);
});

test("SessionRecommendationSignals and completion velocity estimates are generated", () => {
  const service = new SessionIntelligenceService();
  const signalEngine = new SessionRecommendationSignals();

  const fit = service.calculateSessionFit({
    gameId: "game-persona-5-royal",
    availableMinutes: 240,
    playtimeHours: 10,
  });

  const signals = signalEngine.fromFit({
    canonicalGameId: "game-persona-5-royal",
    fit: fit.fit,
    availableMinutes: 240,
  });

  assert.ok(signals.sessionFitBonus >= 0);
  assert.ok(signals.sessionFitBonus <= 1);
  assert.ok(signals.sessionMismatchPenalty >= 0);
  assert.ok(signals.quickWinBonus >= 0);
  assert.ok(signals.longSessionBonus >= 0);

  assert.equal(fit.completionVelocity.estimatedTotalHours, 101);
  assert.ok(fit.completionVelocity.estimatedSessionsRequired > 0);
  assert.ok(fit.completionVelocity.estimatedWeeksRequired > 0);
  assert.ok(Date.parse(fit.completionVelocity.likelyCompletionDate) > Date.now());
});
