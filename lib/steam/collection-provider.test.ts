import assert from "node:assert/strict";
import test from "node:test";

import { SteamCollectionProvider } from "@/lib/steam/collection-provider";

const config = {
  apiKey: "test-key",
  callbackUrl: "http://localhost/auth/steam/callback",
  openidRealm: "http://localhost",
  openidEndpoint: "https://steamcommunity.com/openid/login",
};

test("SteamCollectionProvider normalizes owned games payload", async () => {
  const provider = new SteamCollectionProvider({
    config,
    fetchImpl: async () =>
      Response.json({
        response: {
          games: [
            {
              appid: 1113000,
              name: "Persona 4 Golden",
              playtime_forever: 240,
              playtime_2weeks: 120,
              rtime_last_played: 1_700_000_000,
              img_icon_url: "icon-hash",
              img_logo_url: "logo-hash",
            },
          ],
        },
      }),
  });

  const games = await provider.getOwnedGames("76561198000000000");
  assert.equal(games.length, 1);
  assert.deepEqual(games[0], {
    appId: 1113000,
    title: "Persona 4 Golden",
    totalPlaytimeMinutes: 240,
    recentPlaytimeMinutes: 120,
    lastPlayedAt: "2023-11-14T22:13:20.000Z",
    icon: "icon-hash",
    logo: "logo-hash",
  });
});
