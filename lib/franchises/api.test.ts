import assert from "node:assert/strict";
import test from "node:test";

import { GET as getFranchiseProgress } from "@/app/api/franchises/progress/route";
import { GET as getFranchiseById } from "@/app/api/franchises/[id]/progress/route";
import { GET as getFranchiseRecommendations } from "@/app/api/franchises/[id]/recommendations/route";
import { GET as getNearCompletion } from "@/app/api/franchises/near-completion/route";
import { POST as postLibraryGame } from "@/app/api/library/games/route";
import { resetUserLibraryServiceForTests } from "@/lib/library/container";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("franchise API returns progress, per-franchise recommendations, and near-completion summaries", async () => {
  resetUserLibraryServiceForTests();

  for (const [canonicalGameId, status, platform, platformGameId] of [
    ["game-persona-3-portable", "Completed", "psp", "ULUS-10432"],
    ["game-persona-4-golden", "Completed", "steam", "1113000"],
    ["game-persona-5-royal", "Unplayed", "steam", "P5R"],
    ["game-yakuza-0", "Completed", "steam", "638970"],
  ] as const) {
    const response = await postLibraryGame(
      jsonRequest("http://localhost/api/library/games", "POST", {
        userId: "user-1",
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

  const progressResponse = await getFranchiseProgress(
    new Request("http://localhost/api/franchises/progress?userId=user-1"),
  );
  assert.equal(progressResponse.status, 200);
  const progressPayload = (await progressResponse.json()) as {
    franchises: Array<{ franchiseId: string; completionPercentage: number; nextRecommendedGameId?: string }>;
    series: Array<{ seriesName: string }>;
    summary: { closestFranchisesToCompletion: Array<{ franchiseId: string }> };
  };
  assert.equal(progressPayload.franchises.length, 2);
  assert.equal(progressPayload.franchises[0]?.franchiseId, "fr-persona");
  assert.equal(progressPayload.franchises[0]?.completionPercentage, 66.7);
  assert.equal(progressPayload.series[0]?.seriesName, "Persona Mainline");

  const byIdResponse = await getFranchiseById(
    new Request("http://localhost/api/franchises/fr-persona/progress?userId=user-1"),
    { params: Promise.resolve({ id: "fr-persona" }) },
  );
  assert.equal(byIdResponse.status, 200);
  const byIdPayload = (await byIdResponse.json()) as {
    progress: { franchiseId: string; nextRecommendedGameId?: string };
  };
  assert.equal(byIdPayload.progress.franchiseId, "fr-persona");
  assert.equal(byIdPayload.progress.nextRecommendedGameId, "game-persona-5-royal");

  const recommendationResponse = await getFranchiseRecommendations(
    new Request("http://localhost/api/franchises/fr-yakuza/recommendations?userId=user-1"),
    { params: Promise.resolve({ id: "fr-yakuza" }) },
  );
  assert.equal(recommendationResponse.status, 200);
  const recommendationPayload = (await recommendationResponse.json()) as {
    recommendation: { nextRecommendedGameId?: string; seriesContinuationBonus: number };
  };
  assert.equal(recommendationPayload.recommendation.nextRecommendedGameId, "game-yakuza-kiwami");
  assert.ok(recommendationPayload.recommendation.seriesContinuationBonus > 0);

  const nearCompletionResponse = await getNearCompletion(
    new Request("http://localhost/api/franchises/near-completion?userId=user-1"),
  );
  assert.equal(nearCompletionResponse.status, 200);
  const nearCompletionPayload = (await nearCompletionResponse.json()) as {
    franchises: Array<{ franchiseId: string }>;
  };
  assert.equal(nearCompletionPayload.franchises[0]?.franchiseId, "fr-persona");
});

test("franchise API validates required userId and returns 404 for missing franchise progress", async () => {
  resetUserLibraryServiceForTests();

  const missingUserResponse = await getFranchiseProgress(
    new Request("http://localhost/api/franchises/progress"),
  );
  assert.equal(missingUserResponse.status, 400);

  const missingFranchiseResponse = await getFranchiseById(
    new Request("http://localhost/api/franchises/fr-missing/progress?userId=user-1"),
    { params: Promise.resolve({ id: "fr-missing" }) },
  );
  assert.equal(missingFranchiseResponse.status, 404);
});
