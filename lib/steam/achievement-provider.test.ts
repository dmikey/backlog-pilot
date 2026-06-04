import assert from "node:assert/strict";
import test from "node:test";

import { SteamAchievementProvider } from "@/lib/steam/achievement-provider";

const config = {
  apiKey: "test-key",
  callbackUrl: "http://localhost/auth/steam/callback",
  openidRealm: "http://localhost",
  openidEndpoint: "https://steamcommunity.com/openid/login",
};

test("SteamAchievementProvider normalizes achievement availability and progress", async () => {
  const provider = new SteamAchievementProvider({
    config,
    fetchImpl: async (input) => {
      const url = String(input);

      if (url.includes("GetSchemaForGame") && url.includes("appid=1113000")) {
        return Response.json({
          game: {
            availableGameStats: {
              achievements: [{ name: "A1" }, { name: "A2" }, { name: "A3" }],
            },
          },
        });
      }

      if (url.includes("GetPlayerAchievements") && url.includes("appid=1113000")) {
        return Response.json({
          playerstats: {
            success: true,
            achievements: [{ achieved: 1 }, { achieved: 0 }, { achieved: 1 }],
          },
        });
      }

      if (url.includes("GetSchemaForGame") && url.includes("appid=2222000")) {
        return Response.json({ game: { availableGameStats: { achievements: [] } } });
      }

      return new Response(null, { status: 404 });
    },
  });

  const snapshots = await provider.getAchievementSnapshots("76561198000000000", [1113000, 2222000]);

  assert.deepEqual(snapshots, [
    {
      platformGameId: "1113000",
      totalAchievements: 3,
      unlockedAchievements: 2,
      progressAvailable: true,
    },
    {
      platformGameId: "2222000",
      totalAchievements: 0,
      unlockedAchievements: 0,
      progressAvailable: true,
    },
  ]);
});
