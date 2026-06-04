import assert from "node:assert/strict";
import test from "node:test";

import { GET as getActivity } from "@/app/activity/route";
import { GET as getActivityByGameId } from "@/app/activity/[gameId]/route";
import { GET as getDormantActivity } from "@/app/activity/dormant/route";
import { GET as getMostPlayedActivity } from "@/app/activity/most-played/route";
import { GET as getRecentActivity } from "@/app/activity/recent/route";
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

test("activity endpoints expose synced Steam activity analytics and recommendation signals", async () => {
  setupSteamEnv();
  resetUserLibraryServiceForTests();

  resetSteamServicesForTests({
    collectionFetchImpl: async () =>
      Response.json({
        response: {
          games: [
            {
              appid: 1113000,
              name: "Persona 4 Golden",
              playtime_forever: 5400,
              playtime_2weeks: 240,
              rtime_last_played: Math.floor(Date.now() / 1000) - 24 * 60 * 60,
            },
            {
              appid: 638970,
              name: "Yakuza 0",
              playtime_forever: 120,
              playtime_2weeks: 0,
              rtime_last_played: Math.floor(Date.now() / 1000) - 420 * 24 * 60 * 60,
            },
          ],
        },
      }),
  });

  getSteamServices().accountService.linkAccount({
    userId: "user-activity-api-1",
    profile: {
      steamId: "76561198000000000",
      displayName: "Derek",
      avatarUrl: "https://cdn.example/avatar.jpg",
      profileUrl: "https://steamcommunity.com/profiles/76561198000000000",
    },
  });

  const syncResponse = await postSteamSync(
    jsonRequest("http://localhost/steam/sync", "POST", { userId: "user-activity-api-1" }),
  );
  assert.equal(syncResponse.status, 200);

  const activityResponse = await getActivity(
    new Request("http://localhost/activity?userId=user-activity-api-1"),
  );
  assert.equal(activityResponse.status, 200);

  const activityPayload = (await activityResponse.json()) as {
    activity: Array<{
      activity: { canonicalGameId: string; engagementScore: number };
      classification: string;
    }>;
    recommendationSignals: Array<{ canonicalGameId: string; recentlyPlayedBoost: number }>;
    analytics: { mostPlayedGames: Array<{ canonicalGameId: string }> };
  };

  assert.equal(activityPayload.activity.length, 2);
  assert.equal(activityPayload.analytics.mostPlayedGames[0]?.canonicalGameId, "game-persona-4-golden");
  assert.ok(activityPayload.recommendationSignals.some((signal) => signal.recentlyPlayedBoost > 0));

  const recentResponse = await getRecentActivity(
    new Request("http://localhost/activity/recent?userId=user-activity-api-1"),
  );
  const recentPayload = (await recentResponse.json()) as {
    games: Array<{ activity: { canonicalGameId: string } }>;
  };
  assert.equal(recentPayload.games[0]?.activity.canonicalGameId, "game-persona-4-golden");

  const mostPlayedResponse = await getMostPlayedActivity(
    new Request("http://localhost/activity/most-played?userId=user-activity-api-1"),
  );
  const mostPlayedPayload = (await mostPlayedResponse.json()) as {
    games: Array<{ activity: { canonicalGameId: string } }>;
  };
  assert.equal(mostPlayedPayload.games[0]?.activity.canonicalGameId, "game-persona-4-golden");

  const dormantResponse = await getDormantActivity(
    new Request("http://localhost/activity/dormant?userId=user-activity-api-1"),
  );
  const dormantPayload = (await dormantResponse.json()) as {
    games: Array<{ activity: { canonicalGameId: string } }>;
  };
  assert.equal(dormantPayload.games[0]?.activity.canonicalGameId, "game-yakuza-0");

  const gameResponse = await getActivityByGameId(new Request("http://localhost/activity/game-persona-4-golden?userId=user-activity-api-1"), {
    params: Promise.resolve({ gameId: "game-persona-4-golden" }),
  });
  assert.equal(gameResponse.status, 200);

  const recommendationResponse = await getRecommendations(
    new Request("http://localhost/api/recommendations?userId=user-activity-api-1&platform=steam"),
  );
  assert.equal(recommendationResponse.status, 200);
  const recommendationPayload = (await recommendationResponse.json()) as {
    primaryRecommendation: { gameId: string } | null;
  };
  assert.equal(recommendationPayload.primaryRecommendation?.gameId, "game-persona-4-golden");
});
