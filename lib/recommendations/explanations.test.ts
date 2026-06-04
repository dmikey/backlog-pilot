import assert from "node:assert/strict";
import test from "node:test";

import {
  ExplanationResponseBuilder,
  RecommendationExplanationService,
  type RecommendationExplanationInput,
} from "@/lib/recommendations/explanations";

function getSignals(
  overrides: Partial<RecommendationExplanationInput> = {},
): RecommendationExplanationInput {
  return {
    platform: "nintendo-switch",
    factorBreakdown: {
      completionProbability: 0.91,
      backlogAge: 0.82,
      genreDiversity: 0.76,
      platformPreference: 1,
      sessionFit: 0.93,
      ownershipDuplication: 1,
      activeRotationFit: 0.88,
    },
    completionLikelihood: "high",
    estimatedCompletionHours: 6,
    backlogAgeDays: 730,
    genreNames: ["Detective", "Adventure"],
    overlappingGenreNames: [],
    targetSessionMinutes: 60,
    preferredPlatformMatched: true,
    platformPreferenceRank: 1,
    duplicateOwnershipCount: 1,
    duplicatePenaltyMultiplier: 1,
    isInActiveRotation: false,
    franchise: {
      name: "Persona",
      nextRecommendedGameTitle: "Persona 5 Royal",
      nearCompletionBonus: 1,
      seriesContinuationBonus: 0.8,
      affinityScore: 0.75,
    },
    ...overrides,
  };
}

test("RecommendationExplanationService generates deterministic top reasons", () => {
  const service = new RecommendationExplanationService();
  const first = service.generate({
    useCase: "play-tonight",
    signals: getSignals(),
  });
  const second = service.generate({
    useCase: "play-tonight",
    signals: getSignals(),
  });

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.reasons.map((reason) => reason.message),
    [
      "Estimated completion time is only 6 hours",
      "Excellent fit for a 1-hour session",
      "Matches your preferred platform",
      "Close to completing the franchise",
    ],
  );
});

test("RecommendationExplanationService prioritizes duplicate ownership for purchase advisor", () => {
  const service = new RecommendationExplanationService();
  const result = service.generate({
    useCase: "purchase-advisor",
    signals: getSignals({
      duplicateOwnershipCount: 3,
      duplicatePenaltyMultiplier: 0.65,
      factorBreakdown: {
        ...getSignals().factorBreakdown,
        ownershipDuplication: 0.65,
      },
    }),
  });

  assert.equal(result.reasons[0]?.category, "duplicate-ownership");
  assert.equal(result.reasons[0]?.message, "Already owned on 3 platforms");
});

test("ExplanationResponseBuilder returns UI-safe structured explanation payloads", () => {
  const service = new RecommendationExplanationService();
  const result = service.generate({
    useCase: "backlog-coach",
    signals: getSignals({
      estimatedCompletionHours: 14,
      backlogAgeDays: 910,
      targetSessionMinutes: 120,
    }),
  });
  const response = new ExplanationResponseBuilder().build({
    result,
    alternativeTitle: "Yakuza 0",
    relation: "lower",
  });

  assert.ok(response.whyThisGame.length > 0);
  assert.ok(response.whyNow.length > 0);
  assert.equal(response.useCase, "backlog-coach");
  assert.equal(response.structuredReasons.length, result.reasons.length);
  assert.ok(response.structuredReasons.every((reason) => reason.templateId.length > 0));
  assert.match(response.whyNotSomethingElse, /Yakuza 0/);
});
