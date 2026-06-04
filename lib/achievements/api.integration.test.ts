import assert from "node:assert/strict";
import test from "node:test";

import { GET as getAchievements } from "@/app/achievements/route";
import { GET as getAchievementByGameId } from "@/app/achievements/[gameId]/route";
import { GET as getCompletedAchievements } from "@/app/achievements/completed/route";
import { GET as getNearCompletionAchievements } from "@/app/achievements/near-completion/route";
import { GET as getMasteredAchievements } from "@/app/achievements/mastered/route";
import { GET as getRecommendations } from "@/app/api/recommendations/route";
import { POST as postSteamSync } from "@/app/steam/sync/route";
import { resetUserLibraryServiceForTests } from "@/lib/library/container";
import { getSteamServices, resetSteamServicesForTests } from "@/lib/steam/container";

function setupSteamEnv() {
  process.env.STEAM_API_KEY = "test-steam-key";
  process.env.STEAM_CALLBACK_URL = "http://localhost/auth/steam/callback";
  process.env.STEAM_OPENID_REALM = "http://localhost";
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("achievement endpoints expose synced progress, completion slices, and recommendation-ready signals", async () => {
  setupSteamEnv();
  resetUserLibraryServiceForTests();

  resetSteamServicesForTests({
    enableAchievementImport: true,
    collectionFetchImpl: async () =>
      Response.json({
        response: {
          games: [
            {
              appid: 1113000,
              name: "Persona 4 Golden",
              playtime_forever: 600,
              playtime_2weeks: 120,
              rtime_last_played: 1_700_000_000,
            },
            {
              appid: 638970,
              name: "Yakuza 0",
              playtime_forever: 300,
              playtime_2weeks: 50,
              rtime_last_played: 1_700_100_000,
            },
            {
              appid: 1446780,
              name: "Monster Hunter Rise",
              playtime_forever: 100,
              playtime_2weeks: 0,
            },
          ],
        },
      }),
    achievementFetchImpl: async (input) => {
      const url = String(input);

      if (url.includes("GetSchemaForGame") && url.includes("appid=1113000")) {
        return Response.json({
          game: {
            availableGameStats: {
              achievements: Array.from({ length: 50 }).map((_, index) => ({ name: `A${index}` })),
            },
          },
        });
      }

      if (url.includes("GetPlayerAchievements") && url.includes("appid=1113000")) {
        return Response.json({
          playerstats: {
            success: true,
            achievements: [
              ...Array.from({ length: 45 }).map(() => ({ achieved: 1 })),
              ...Array.from({ length: 5 }).map(() => ({ achieved: 0 })),
            ],
          },
        });
      }

      if (url.includes("GetSchemaForGame") && url.includes("appid=638970")) {
        return Response.json({
          game: {
            availableGameStats: {
              achievements: Array.from({ length: 55 }).map((_, index) => ({ name: `Y${index}` })),
            },
          },
        });
      }

      if (url.includes("GetPlayerAchievements") && url.includes("appid=638970")) {
        return Response.json({
          playerstats: {
            success: true,
            achievements: Array.from({ length: 55 }).map(() => ({ achieved: 1 })),
          },
        });
      }

      if (url.includes("GetSchemaForGame") && url.includes("appid=1446780")) {
        return Response.json({ game: { availableGameStats: { achievements: [] } } });
      }

      return new Response(null, { status: 404 });
    },
  });

  getSteamServices().accountService.linkAccount({
    userId: "user-achievement-api-1",
    profile: {
      steamId: "76561198000000000",
      displayName: "Derek",
      avatarUrl: "https://cdn.example/avatar.jpg",
      profileUrl: "https://steamcommunity.com/profiles/76561198000000000",
    },
  });

  const syncResponse = await postSteamSync(
    jsonRequest("http://localhost/steam/sync", "POST", { userId: "user-achievement-api-1" }),
  );
  assert.equal(syncResponse.status, 200);

  const achievementsResponse = await getAchievements(
    new Request("http://localhost/achievements?userId=user-achievement-api-1"),
  );
  assert.equal(achievementsResponse.status, 200);
  const achievementsPayload = (await achievementsResponse.json()) as {
    achievements: Array<{ canonicalGameId: string; completionPercentage: number }>;
    analytics: { nearCompletionOpportunities: Array<{ canonicalGameId: string }> };
    recommendationSignals: Array<{ canonicalGameId: string; nearCompletionBonus: number }>;
  };
  assert.equal(achievementsPayload.achievements.length, 3);
  assert.equal(
    achievementsPayload.achievements.find((entry) => entry.canonicalGameId === "game-persona-4-golden")
      ?.completionPercentage,
    90,
  );
  assert.ok(
    achievementsPayload.analytics.nearCompletionOpportunities.some(
      (entry) => entry.canonicalGameId === "game-persona-4-golden",
    ),
  );
  assert.equal(
    achievementsPayload.recommendationSignals.find((entry) => entry.canonicalGameId === "game-persona-4-golden")
      ?.nearCompletionBonus,
    1,
  );

  const completedResponse = await getCompletedAchievements(
    new Request("http://localhost/achievements/completed?userId=user-achievement-api-1"),
  );
  assert.equal(completedResponse.status, 200);
  const completedPayload = (await completedResponse.json()) as {
    games: Array<{ canonicalGameId: string }>;
  };
  assert.deepEqual(completedPayload.games.map((entry) => entry.canonicalGameId), ["game-yakuza-0"]);

  const nearCompletionResponse = await getNearCompletionAchievements(
    new Request("http://localhost/achievements/near-completion?userId=user-achievement-api-1"),
  );
  assert.equal(nearCompletionResponse.status, 200);
  const nearCompletionPayload = (await nearCompletionResponse.json()) as {
    games: Array<{ canonicalGameId: string }>;
  };
  assert.deepEqual(nearCompletionPayload.games.map((entry) => entry.canonicalGameId), [
    "game-persona-4-golden",
  ]);

  const masteredResponse = await getMasteredAchievements(
    new Request("http://localhost/achievements/mastered?userId=user-achievement-api-1"),
  );
  assert.equal(masteredResponse.status, 200);
  const masteredPayload = (await masteredResponse.json()) as {
    games: Array<{ canonicalGameId: string }>;
  };
  assert.deepEqual(masteredPayload.games.map((entry) => entry.canonicalGameId), ["game-yakuza-0"]);

  const gameResponse = await getAchievementByGameId(
    new Request("http://localhost/achievements/game-persona-4-golden?userId=user-achievement-api-1"),
    { params: Promise.resolve({ gameId: "game-persona-4-golden" }) },
  );
  assert.equal(gameResponse.status, 200);
  const gamePayload = (await gameResponse.json()) as {
    completionPercentage: number;
    status: string;
  };
  assert.equal(gamePayload.completionPercentage, 90);
  assert.equal(gamePayload.status, "Near Completion");

  const recommendationResponse = await getRecommendations(
    new Request("http://localhost/api/recommendations?userId=user-achievement-api-1&type=play-tonight"),
  );
  assert.equal(recommendationResponse.status, 200);
  const recommendationPayload = (await recommendationResponse.json()) as {
    primaryRecommendation: { gameId: string } | null;
    alternatives: Array<{ gameId: string }>;
  };
  const recommendationGameIds = [
    recommendationPayload.primaryRecommendation?.gameId,
    ...recommendationPayload.alternatives.map((entry) => entry.gameId),
  ].filter((value): value is string => Boolean(value));
  assert.ok(recommendationGameIds.includes("game-persona-4-golden"));
});

test("Steam sync handles missing achievement progress without failing", async () => {
  setupSteamEnv();
  resetUserLibraryServiceForTests();

  resetSteamServicesForTests({
    enableAchievementImport: true,
    collectionFetchImpl: async () =>
      Response.json({
        response: {
          games: [{ appid: 1113000, name: "Persona 4 Golden", playtime_forever: 0 }],
        },
      }),
    achievementFetchImpl: async (input) => {
      const url = String(input);

      if (url.includes("GetSchemaForGame")) {
        return Response.json({
          game: {
            availableGameStats: {
              achievements: Array.from({ length: 50 }).map((_, index) => ({ name: `A${index}` })),
            },
          },
        });
      }

      if (url.includes("GetPlayerAchievements")) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, { status: 404 });
    },
  });

  getSteamServices().accountService.linkAccount({
    userId: "user-achievement-api-2",
    profile: {
      steamId: "76561198000000001",
      displayName: "Mikey",
      avatarUrl: "https://cdn.example/avatar-2.jpg",
      profileUrl: "https://steamcommunity.com/profiles/76561198000000001",
    },
  });

  const syncResponse = await postSteamSync(
    jsonRequest("http://localhost/steam/sync", "POST", { userId: "user-achievement-api-2" }),
  );
  assert.equal(syncResponse.status, 200);

  const achievementsResponse = await getAchievements(
    new Request("http://localhost/achievements?userId=user-achievement-api-2"),
  );
  assert.equal(achievementsResponse.status, 200);
  const payload = (await achievementsResponse.json()) as {
    achievements: Array<{ totalAchievements: number; unlockedAchievements: number }>;
  };
  assert.equal(payload.achievements.length, 1);
  assert.equal(payload.achievements[0]?.totalAchievements, 50);
  assert.equal(payload.achievements[0]?.unlockedAchievements, 0);
});
