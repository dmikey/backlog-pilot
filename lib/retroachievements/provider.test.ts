import assert from "node:assert/strict";
import test from "node:test";

import { RetroAchievementsProvider } from "@/lib/retroachievements/provider";
import type { RetroAchievementsConfig } from "@/lib/retroachievements/types";
import { RetroAchievementsValidationError } from "@/lib/retroachievements/types";

const testConfig: RetroAchievementsConfig = {
  username: "testuser",
  apiKey: "testapikey",
  baseUrl: "https://retroachievements.org/API",
};

function makeProfileResponse() {
  return Response.json({
    Username: "Derek",
    TotalPoints: 4200,
    TotalSoftcorePoints: 600,
    Rank: 12345,
    RecentlyPlayedCount: 3,
  });
}

function makeCompletionProgressResponse(entries: object[], total?: number) {
  return Response.json({
    Count: entries.length,
    Total: total ?? entries.length,
    Results: entries,
  });
}

test("RetroAchievementsProvider.getUserProfile normalizes API response", async () => {
  const provider = new RetroAchievementsProvider({
    config: testConfig,
    fetchImpl: async () => makeProfileResponse(),
  });

  const profile = await provider.getUserProfile("Derek");

  assert.equal(profile.username, "Derek");
  assert.equal(profile.points, 4200);
  assert.equal(profile.softcorePoints, 600);
  assert.equal(profile.totalPoints, 4800);
  assert.equal(profile.rank, 12345);
  assert.equal(profile.recentGamesCount, 3);
});

test("RetroAchievementsProvider.getUserProfile throws on empty username", async () => {
  const provider = new RetroAchievementsProvider({
    config: testConfig,
    fetchImpl: async () => makeProfileResponse(),
  });

  await assert.rejects(
    () => provider.getUserProfile("  "),
    RetroAchievementsValidationError,
  );
});

test("RetroAchievementsProvider.getUserProfile throws on non-OK response", async () => {
  const provider = new RetroAchievementsProvider({
    config: testConfig,
    fetchImpl: async () => new Response(null, { status: 401 }),
  });

  await assert.rejects(
    () => provider.getUserProfile("Derek"),
    RetroAchievementsValidationError,
  );
});

test("RetroAchievementsProvider.getUserCompletionProgress returns normalized game list", async () => {
  const entries = [
    {
      GameID: 7173,
      Title: "Pokemon Emerald",
      ConsoleID: 5,
      ConsoleName: "Game Boy Advance",
      ImageIcon: "/Images/051168.png",
      NumPossibleAchievements: 48,
      NumAchieved: 42,
      NumAchievedHardcore: 38,
    },
    {
      GameID: 3354,
      Title: "Castlevania: Aria of Sorrow",
      ConsoleID: 5,
      ConsoleName: "Game Boy Advance",
      ImageIcon: "/Images/051169.png",
      NumPossibleAchievements: 50,
      NumAchieved: 40,
      NumAchievedHardcore: 32,
    },
  ];

  const provider = new RetroAchievementsProvider({
    config: testConfig,
    fetchImpl: async () => makeCompletionProgressResponse(entries),
  });

  const progress = await provider.getUserCompletionProgress("Derek");

  assert.equal(progress.length, 2);

  const emerald = progress.find((p) => p.gameTitle === "Pokemon Emerald");
  assert.ok(emerald);
  assert.equal(emerald.retroAchievementsGameId, 7173);
  assert.equal(emerald.consoleId, 5);
  assert.equal(emerald.consoleName, "Game Boy Advance");
  assert.equal(emerald.totalAchievements, 48);
  assert.equal(emerald.numAwardedToUser, 42);
  assert.equal(emerald.numAwardedToUserHardcore, 38);
  assert.equal(emerald.percentComplete, 88);
  assert.equal(emerald.percentCompleteHardcore, 79);
});

test("RetroAchievementsProvider.getUserCompletionProgress skips entries with missing game ID", async () => {
  const entries = [
    { Title: "Incomplete Entry", ConsoleID: 5 },
    {
      GameID: 7173,
      Title: "Pokemon Emerald",
      ConsoleID: 5,
      ConsoleName: "Game Boy Advance",
      NumPossibleAchievements: 48,
      NumAchieved: 42,
      NumAchievedHardcore: 38,
    },
  ];

  const provider = new RetroAchievementsProvider({
    config: testConfig,
    fetchImpl: async () => makeCompletionProgressResponse(entries),
  });

  const progress = await provider.getUserCompletionProgress("Derek");
  assert.equal(progress.length, 1);
  assert.equal(progress[0]?.gameTitle, "Pokemon Emerald");
});

test("RetroAchievementsProvider.getUserCompletionProgress caps unlocked to total", async () => {
  const entries = [
    {
      GameID: 1,
      Title: "Test Game",
      ConsoleID: 5,
      ConsoleName: "GBA",
      NumPossibleAchievements: 10,
      NumAchieved: 15,
      NumAchievedHardcore: 12,
    },
  ];

  const provider = new RetroAchievementsProvider({
    config: testConfig,
    fetchImpl: async () => makeCompletionProgressResponse(entries),
  });

  const [result] = await provider.getUserCompletionProgress("Derek");
  assert.equal(result?.numAwardedToUser, 10);
  assert.equal(result?.numAwardedToUserHardcore, 10);
  assert.equal(result?.percentComplete, 100);
});

test("RetroAchievementsProvider sends correct auth params in URL", async () => {
  let capturedUrl: string | undefined;

  const provider = new RetroAchievementsProvider({
    config: testConfig,
    fetchImpl: async (input) => {
      capturedUrl = String(input);
      return makeProfileResponse();
    },
  });

  await provider.getUserProfile("Derek");

  assert.ok(capturedUrl?.includes("z=testuser"), "should include username param z");
  assert.ok(capturedUrl?.includes("y=testapikey"), "should include API key param y");
  assert.ok(capturedUrl?.includes("API_GetUserSummary.php"), "should call correct endpoint");
});
