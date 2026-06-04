import assert from "node:assert/strict";
import test from "node:test";

import { GET as getCompletionPredictions } from "@/app/completion-predictions/route";
import { GET as getCompletionPredictionByGame } from "@/app/completion-predictions/[gameId]/route";
import { GET as getHighConfidencePredictions } from "@/app/completion-predictions/high-confidence/route";
import { GET as getHighRiskPredictions } from "@/app/completion-predictions/high-risk/route";
import { GET as getRecommendations } from "@/app/api/recommendations/route";
import { getSteamActivityService, resetSteamActivityServiceForTests } from "@/lib/activity/container";
import { getAchievementService, resetAchievementServiceForTests } from "@/lib/achievements/container";
import { POST as postLibraryGame } from "@/app/api/library/games/route";
import { resetUserLibraryServiceForTests } from "@/lib/library/container";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("completion prediction API returns predictions, analytics, high-confidence, and high-risk views", async () => {
  resetUserLibraryServiceForTests();
  resetSteamActivityServiceForTests();
  resetAchievementServiceForTests();

  for (const [canonicalGameId, status, platform, platformGameId] of [
    ["game-persona-3-portable", "Completed", "psp", "ULUS-10432"],
    ["game-persona-4-golden", "Completed", "steam", "1113000"],
    ["game-persona-5-royal", "Unplayed", "steam", "P5R"],
    ["game-monster-hunter-rise", "Abandoned", "nintendo-switch", "0100B04011742000"],
    ["game-final-fantasy-tactics-wotl", "Unplayed", "psp", "ULUS10297"],
  ] as const) {
    const response = await postLibraryGame(
      jsonRequest("http://localhost/api/library/games", "POST", {
        userId: "user-completion-api-1",
        canonicalGameId,
        status,
        ownership: {
          platform,
          platformGameId,
          source: "manual-import",
          ownershipType: "Digital",
        },
      }),
    );
    assert.equal(response.status, 201);
  }

  await getSteamActivityService().upsertActivities([
    {
      userId: "user-completion-api-1",
      canonicalGameId: "game-persona-5-royal",
      platform: "steam",
      totalPlaytimeMinutes: 300,
      recentPlaytimeMinutes: 160,
      lastPlayedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  await getAchievementService().upsertProgress([
    {
      userId: "user-completion-api-1",
      canonicalGameId: "game-persona-4-golden",
      platform: "steam",
      totalAchievements: 50,
      unlockedAchievements: 45,
    },
  ]);

  const listResponse = await getCompletionPredictions(
    new Request("http://localhost/completion-predictions?userId=user-completion-api-1"),
  );
  assert.equal(listResponse.status, 200);
  const listPayload = (await listResponse.json()) as {
    predictions: Array<{
      canonicalGameId: string;
      completionLikelihood: number;
      confidence: number;
      abandonmentRisk: string;
    }>;
    analytics: { predictionAccuracy: number; highestCompletionGenres: Array<{ genreId: string }> };
  };
  assert.ok(listPayload.predictions.length > 0);
  assert.ok(listPayload.predictions.every((entry) => entry.completionLikelihood >= 0 && entry.completionLikelihood <= 1));
  assert.ok(listPayload.predictions.every((entry) => entry.confidence >= 0 && entry.confidence <= 1));
  assert.ok(listPayload.predictions.every((entry) => entry.abandonmentRisk.length > 0));
  assert.ok(listPayload.analytics.predictionAccuracy >= 0);
  assert.ok(listPayload.analytics.highestCompletionGenres.length > 0);

  const byGameResponse = await getCompletionPredictionByGame(
    new Request("http://localhost/completion-predictions/game-persona-5-royal?userId=user-completion-api-1"),
    { params: Promise.resolve({ gameId: "game-persona-5-royal" }) },
  );
  assert.equal(byGameResponse.status, 200);
  const byGamePayload = (await byGameResponse.json()) as { canonicalGameId: string; game: string };
  assert.equal(byGamePayload.canonicalGameId, "game-persona-5-royal");
  assert.equal(byGamePayload.game, "Persona 5 Royal");

  const highConfidenceResponse = await getHighConfidencePredictions(
    new Request("http://localhost/completion-predictions/high-confidence?userId=user-completion-api-1"),
  );
  assert.equal(highConfidenceResponse.status, 200);
  const highConfidencePayload = (await highConfidenceResponse.json()) as {
    predictions: Array<{ confidence: number }>;
  };
  assert.ok(highConfidencePayload.predictions.every((entry) => entry.confidence >= 0.75));

  const highRiskResponse = await getHighRiskPredictions(
    new Request("http://localhost/completion-predictions/high-risk?userId=user-completion-api-1"),
  );
  assert.equal(highRiskResponse.status, 200);
  const highRiskPayload = (await highRiskResponse.json()) as {
    predictions: Array<{ abandonmentRisk: string }>;
  };
  assert.ok(highRiskPayload.predictions.every((entry) => entry.abandonmentRisk === "High Risk"));
});

test("completion prediction signals integrate into recommendation ranking output", async () => {
  resetUserLibraryServiceForTests();
  resetSteamActivityServiceForTests();
  resetAchievementServiceForTests();

  for (const [canonicalGameId, status, platform, platformGameId] of [
    ["game-persona-3-portable", "Completed", "psp", "ULUS-10432"],
    ["game-persona-4-golden", "Completed", "steam", "1113000"],
    ["game-persona-5-royal", "Unplayed", "steam", "P5R"],
    ["game-yakuza-kiwami", "Unplayed", "steam", "834530"],
  ] as const) {
    const response = await postLibraryGame(
      jsonRequest("http://localhost/api/library/games", "POST", {
        userId: "user-completion-api-2",
        canonicalGameId,
        status,
        ownership: {
          platform,
          platformGameId,
          source: "manual-import",
          ownershipType: "Digital",
        },
      }),
    );
    assert.equal(response.status, 201);
  }

  const recommendationResponse = await getRecommendations(
    new Request("http://localhost/api/recommendations?userId=user-completion-api-2&type=play-tonight"),
  );
  assert.equal(recommendationResponse.status, 200);
  const recommendationPayload = (await recommendationResponse.json()) as {
    primaryRecommendation: { reasons: string[] } | null;
    alternatives: Array<{ reasons: string[] }>;
  };

  const allReasons = [
    ...(recommendationPayload.primaryRecommendation?.reasons ?? []),
    ...recommendationPayload.alternatives.flatMap((entry) => entry.reasons),
  ];
  assert.ok(
    allReasons.some((reason) => reason.includes("Completion prediction")),
  );
});
