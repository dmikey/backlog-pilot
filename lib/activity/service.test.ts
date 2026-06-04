import assert from "node:assert/strict";
import test from "node:test";

import { SteamActivityService } from "@/lib/activity/service";

test("SteamActivityService upserts history and returns analytics slices", async () => {
  const service = new SteamActivityService();

  await service.upsertActivities([
    {
      userId: "user-activity-1",
      canonicalGameId: "game-persona-4-golden",
      platform: "steam",
      totalPlaytimeMinutes: 5200,
      recentPlaytimeMinutes: 180,
      lastPlayedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      userId: "user-activity-1",
      canonicalGameId: "game-skyrim",
      platform: "steam",
      totalPlaytimeMinutes: 120,
      recentPlaytimeMinutes: 0,
      lastPlayedAt: new Date(Date.now() - 420 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  await service.upsertActivities([
    {
      userId: "user-activity-1",
      canonicalGameId: "game-persona-4-golden",
      platform: "steam",
      totalPlaytimeMinutes: 5300,
      recentPlaytimeMinutes: 240,
      lastPlayedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  assert.equal(service.listForUser("user-activity-1").length, 2);
  assert.equal(service.getMostPlayed("user-activity-1")[0]?.activity.canonicalGameId, "game-persona-4-golden");
  assert.equal(service.getDormant("user-activity-1")[0]?.activity.canonicalGameId, "game-skyrim");

  const history = service.getHistory("user-activity-1", "game-persona-4-golden", "steam");
  assert.equal(history.length, 2);

  const summary = service.getAnalyticsSummary("user-activity-1");
  assert.equal(summary.mostPlayedGames.length, 2);
  assert.equal(summary.activeRotationCandidates[0]?.canonicalGameId, "game-persona-4-golden");
  assert.equal(summary.platformUsageDistribution[0]?.platform, "steam");
});
