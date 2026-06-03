import assert from "node:assert/strict";
import test from "node:test";

import { GET as getSteamLibrary } from "@/app/steam/library/route";
import { POST as refreshSteamSync } from "@/app/steam/sync/refresh/route";
import { POST as postSteamSync } from "@/app/steam/sync/route";
import { GET as getSteamSyncStatus } from "@/app/steam/sync/status/route";
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

test("Steam sync endpoints import, reconcile, and expose sync status/library data", async () => {
  setupSteamEnv();
  resetUserLibraryServiceForTests();

  const responses = [
    {
      response: {
        games: [
          {
            appid: 1113000,
            name: "Persona 4 Golden",
            playtime_forever: 120,
            rtime_last_played: 1_700_000_000,
            img_icon_url: "icon-p4g",
            img_logo_url: "logo-p4g",
          },
          {
            appid: 638970,
            name: "Yakuza 0",
            playtime_forever: 30,
            rtime_last_played: 1_700_100_000,
            img_icon_url: "icon-y0",
            img_logo_url: "logo-y0",
          },
          {
            appid: 999000,
            name: "Unknown Steam Game",
            playtime_forever: 5,
          },
        ],
      },
    },
    {
      response: {
        games: [
          {
            appid: 1113000,
            name: "Persona 4 Golden",
            playtime_forever: 240,
            rtime_last_played: 1_700_200_000,
            img_icon_url: "icon-p4g",
            img_logo_url: "logo-p4g",
          },
          {
            appid: 1446780,
            name: "Monster Hunter Rise",
            playtime_forever: 60,
            rtime_last_played: 1_700_300_000,
            img_icon_url: "icon-mhr",
            img_logo_url: "logo-mhr",
          },
        ],
      },
    },
  ];

  let fetchCount = 0;

  resetSteamServicesForTests({
    collectionFetchImpl: async () => {
      const index = Math.min(fetchCount, responses.length - 1);
      const payload = responses[index];
      fetchCount += 1;
      return Response.json(payload);
    },
  });

  getSteamServices().accountService.linkAccount({
    userId: "user-1",
    profile: {
      steamId: "76561198000000000",
      displayName: "Derek",
      avatarUrl: "https://cdn.example/avatar.jpg",
      profileUrl: "https://steamcommunity.com/profiles/76561198000000000",
    },
  });

  const syncResponse = await postSteamSync(
    jsonRequest("http://localhost/steam/sync", "POST", { userId: "user-1" }),
  );
  assert.equal(syncResponse.status, 200);
  const syncPayload = (await syncResponse.json()) as {
    gamesImported: number;
    gamesMatched: number;
    gamesUnmatched: number;
    newAcquisitions: number;
  };
  assert.equal(syncPayload.gamesImported, 3);
  assert.equal(syncPayload.gamesMatched, 2);
  assert.equal(syncPayload.gamesUnmatched, 1);
  assert.equal(syncPayload.newAcquisitions, 2);

  const statusResponse = await getSteamSyncStatus(
    new Request("http://localhost/steam/sync/status?userId=user-1"),
  );
  assert.equal(statusResponse.status, 200);
  const statusPayload = (await statusResponse.json()) as {
    status: { state: string; gamesImported: number };
  };
  assert.equal(statusPayload.status.state, "completed");
  assert.equal(statusPayload.status.gamesImported, 3);

  const libraryResponse = await getSteamLibrary(new Request("http://localhost/steam/library?userId=user-1"));
  assert.equal(libraryResponse.status, 200);
  const libraryPayload = (await libraryResponse.json()) as {
    games: Array<{ game: { playtimeHours: number } }>;
    mostPlayed: Array<{ game: { playtimeHours: number } }>;
    recentlyPlayed: Array<{ game: { metadata?: Record<string, unknown> } }>;
    neverPlayed: unknown[];
    unmatched: Array<{ steamAppId: number }>;
  };
  assert.equal(libraryPayload.games.length, 2);
  assert.equal(libraryPayload.mostPlayed[0]?.game.playtimeHours, 2);
  assert.equal(libraryPayload.unmatched[0]?.steamAppId, 999000);
  assert.equal(libraryPayload.neverPlayed.length, 0);
  assert.ok(libraryPayload.recentlyPlayed.length >= 1);

  const refreshResponse = await refreshSteamSync(
    jsonRequest("http://localhost/steam/sync/refresh", "POST", { userId: "user-1" }),
  );
  assert.equal(refreshResponse.status, 200);
  const refreshPayload = (await refreshResponse.json()) as {
    refreshed: boolean;
    status: { newAcquisitions: number; removedTitles: number; updatedGames: number };
  };
  assert.equal(refreshPayload.refreshed, true);
  assert.equal(refreshPayload.status.newAcquisitions, 1);
  assert.equal(refreshPayload.status.removedTitles, 1);
  assert.equal(refreshPayload.status.updatedGames, 1);

  const afterRefreshLibraryResponse = await getSteamLibrary(
    new Request("http://localhost/steam/library?userId=user-1"),
  );
  const afterRefreshPayload = (await afterRefreshLibraryResponse.json()) as {
    games: Array<{ game: { canonicalGameId: string; playtimeHours: number } }>;
    unmatched: unknown[];
  };

  assert.deepEqual(
    afterRefreshPayload.games
      .map((entry) => entry.game.canonicalGameId)
      .slice()
      .sort(),
    ["game-monster-hunter-rise", "game-persona-4-golden"],
  );
  assert.equal(
    afterRefreshPayload.games.find((entry) => entry.game.canonicalGameId === "game-persona-4-golden")?.game
      .playtimeHours,
    4,
  );
  assert.equal(afterRefreshPayload.unmatched.length, 0);
});
