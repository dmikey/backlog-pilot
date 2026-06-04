import assert from "node:assert/strict";
import test from "node:test";

import { POST as postLibraryGame } from "@/app/api/library/games/route";
import { GET as getRecommendations } from "@/app/api/recommendations/route";
import { POST as postSteamSync } from "@/app/steam/sync/route";
import { GET as getSessionCategories } from "@/app/sessions/categories/route";
import { GET as getSessionFitByGame } from "@/app/sessions/fit/[gameId]/route";
import { GET as getSessionRecommendations } from "@/app/sessions/recommendations/route";
import { POST as postSessionCalculate } from "@/app/sessions/calculate/route";
import { resetUserLibraryServiceForTests } from "@/lib/library/container";
import { getSteamServices, resetSteamServicesForTests } from "@/lib/steam/container";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function setupSteamEnv() {
  process.env.STEAM_API_KEY = "test-steam-key";
  process.env.STEAM_CALLBACK_URL = "http://localhost/auth/steam/callback";
  process.env.STEAM_OPENID_REALM = "http://localhost";
}

test("session API exposes categories, fit, velocity, and recommendation analytics", async () => {
  resetUserLibraryServiceForTests();

  for (const [canonicalGameId, status, platform, platformGameId, playtimeHours] of [
    ["game-persona-5-royal", "Unplayed", "steam", "P5R", 0],
    ["game-yakuza-0", "Active", "steam", "638970", 6],
    ["game-final-fantasy-tactics-wotl", "Unplayed", "psp", "ULUS10297", 0],
  ] as const) {
    const response = await postLibraryGame(
      jsonRequest("http://localhost/api/library/games", "POST", {
        userId: "user-session-api-1",
        canonicalGameId,
        status,
        playtimeHours,
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

  const categoriesResponse = await getSessionCategories();
  assert.equal(categoriesResponse.status, 200);
  const categoriesPayload = (await categoriesResponse.json()) as {
    categories: Array<{ label: string; minMinutes: number }>;
  };
  assert.equal(categoriesPayload.categories.length, 5);

  const fitResponse = await getSessionFitByGame(
    new Request("http://localhost/sessions/fit/game-persona-5-royal?availableMinutes=45&playtimeHours=10"),
    { params: Promise.resolve({ gameId: "game-persona-5-royal" }) },
  );
  assert.equal(fitResponse.status, 200);
  const fitPayload = (await fitResponse.json()) as {
    fit: { sessionFitScore: number };
    completionVelocity: { estimatedTotalHours: number; estimatedSessionsRequired: number };
    recommendationSignals: { sessionFitBonus: number };
  };
  assert.equal(fitPayload.completionVelocity.estimatedTotalHours, 101);
  assert.ok(fitPayload.fit.sessionFitScore >= 0);
  assert.ok(fitPayload.recommendationSignals.sessionFitBonus >= 0);
  assert.ok(fitPayload.completionVelocity.estimatedSessionsRequired > 0);

  const calculateResponse = await postSessionCalculate(
    jsonRequest("http://localhost/sessions/calculate", "POST", {
      gameId: "game-yakuza-0",
      availableMinutes: 120,
      playtimeHours: 4,
    }),
  );
  assert.equal(calculateResponse.status, 200);

  const recommendationsResponse = await getSessionRecommendations(
    new Request("http://localhost/sessions/recommendations?userId=user-session-api-1&availableMinutes=45"),
  );
  assert.equal(recommendationsResponse.status, 200);
  const recommendationsPayload = (await recommendationsResponse.json()) as {
    recommendations: Array<{
      gameId: string;
      sessionFitScore: number;
      recommendationSignals: { sessionFitBonus: number };
    }>;
    analytics: { averageSessionDuration: number };
  };

  assert.ok(recommendationsPayload.recommendations.length > 0);
  assert.ok(recommendationsPayload.recommendations[0]!.sessionFitScore >= 0);
  assert.ok(recommendationsPayload.recommendations[0]!.recommendationSignals.sessionFitBonus >= 0);
  assert.ok(recommendationsPayload.analytics.averageSessionDuration > 0);
});

test("session intelligence integrates with activity and recommendation ranking", async () => {
  setupSteamEnv();
  resetUserLibraryServiceForTests();

  resetSteamServicesForTests({
    collectionFetchImpl: async () =>
      Response.json({
        response: {
          games: [
            {
              appid: 638970,
              name: "Yakuza 0",
              playtime_forever: 1800,
              playtime_2weeks: 240,
              rtime_last_played: Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60,
            },
            {
              appid: 1113000,
              name: "Persona 4 Golden",
              playtime_forever: 90,
              playtime_2weeks: 0,
              rtime_last_played: Math.floor(Date.now() / 1000) - 420 * 24 * 60 * 60,
            },
          ],
        },
      }),
  });

  getSteamServices().accountService.linkAccount({
    userId: "user-session-api-2",
    profile: {
      steamId: "76561198000000000",
      displayName: "Derek",
      avatarUrl: "https://cdn.example/avatar.jpg",
      profileUrl: "https://steamcommunity.com/profiles/76561198000000000",
    },
  });

  const syncResponse = await postSteamSync(
    jsonRequest("http://localhost/steam/sync", "POST", { userId: "user-session-api-2" }),
  );
  assert.equal(syncResponse.status, 200);

  const sessionResponse = await getSessionRecommendations(
    new Request("http://localhost/sessions/recommendations?userId=user-session-api-2&availableMinutes=45"),
  );
  assert.equal(sessionResponse.status, 200);
  const sessionPayload = (await sessionResponse.json()) as {
    recommendations: Array<{ gameId: string; sessionFitScore: number }>;
  };
  assert.ok(sessionPayload.recommendations.length > 0);

  const recommendationResponse = await getRecommendations(
    new Request("http://localhost/api/recommendations?userId=user-session-api-2&targetSessionMinutes=45"),
  );
  assert.equal(recommendationResponse.status, 200);
  const recommendationPayload = (await recommendationResponse.json()) as {
    primaryRecommendation: { score: number; reasons: string[] } | null;
  };
  assert.ok((recommendationPayload.primaryRecommendation?.score ?? 0) >= 0);
  assert.ok(
    (recommendationPayload.primaryRecommendation?.reasons.some((reason) => reason.includes("fit for")) ?? false),
  );
});
