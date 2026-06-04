import assert from "node:assert/strict";
import test from "node:test";

import { SteamEngagementEngine } from "@/lib/activity/engagement-engine";

test("SteamEngagementEngine scores engagement and classifies activity states", () => {
  const engine = new SteamEngagementEngine();

  const activeSignal = engine.getRecommendationSignals({
    userId: "user-1",
    canonicalGameId: "game-persona-4-golden",
    platform: "steam",
    totalPlaytimeMinutes: 5400,
    recentPlaytimeMinutes: 240,
    lastPlayedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    engagementScore: 0,
    updatedAt: new Date().toISOString(),
  });

  assert.equal(activeSignal.classification, "Active");
  assert.ok(activeSignal.engagementScore > 0.7);
  assert.ok(activeSignal.activeGameContinuationBonus > 0);

  const dormantSignal = engine.getRecommendationSignals({
    userId: "user-1",
    canonicalGameId: "game-skyrim",
    platform: "steam",
    totalPlaytimeMinutes: 240,
    recentPlaytimeMinutes: 0,
    lastPlayedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    engagementScore: 0,
    updatedAt: new Date().toISOString(),
  });

  assert.equal(dormantSignal.classification, "Dormant");
  assert.ok(dormantSignal.dormantGameBoost > 0);

  const abandoned = engine.classify({
    totalPlaytimeMinutes: 60,
    recentPlaytimeMinutes: 0,
    lastPlayedAt: new Date(Date.now() - 220 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert.equal(abandoned, "Abandoned");
});
