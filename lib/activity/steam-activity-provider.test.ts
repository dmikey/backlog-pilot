import assert from "node:assert/strict";
import test from "node:test";

import { SteamActivityProvider } from "@/lib/activity/steam-activity-provider";
import { SteamCollectionProvider } from "@/lib/steam/collection-provider";

const config = {
  apiKey: "test-key",
  callbackUrl: "http://localhost/auth/steam/callback",
  openidRealm: "http://localhost",
  openidEndpoint: "https://steamcommunity.com/openid/login",
};

test("SteamActivityProvider normalizes playtime snapshots", async () => {
  const collectionProvider = new SteamCollectionProvider({
    config,
    fetchImpl: async () =>
      Response.json({
        response: {
          games: [
            {
              appid: 1113000,
              name: "Persona 4 Golden",
              playtime_forever: 5200.8,
              playtime_2weeks: 180.3,
              rtime_last_played: 1_700_000_000,
            },
          ],
        },
      }),
  });
  const provider = new SteamActivityProvider(collectionProvider);

  const snapshots = await provider.getPlaytimeSnapshots("76561198000000000");

  assert.deepEqual(snapshots, [
    {
      platformGameId: "1113000",
      totalPlaytimeMinutes: 5200,
      recentPlaytimeMinutes: 180,
      lastPlayedAt: "2023-11-14T22:13:20.000Z",
    },
  ]);
});
