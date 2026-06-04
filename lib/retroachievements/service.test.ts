import assert from "node:assert/strict";
import test from "node:test";

import { AchievementService } from "@/lib/achievements/service";
import { RetroMasteryEngine } from "@/lib/retroachievements/mastery-engine";
import { RetroAchievementsProvider } from "@/lib/retroachievements/provider";
import { RetroAchievementService } from "@/lib/retroachievements/service";
import type { RetroAchievementsConfig } from "@/lib/retroachievements/types";

const testConfig: RetroAchievementsConfig = {
  username: "testuser",
  apiKey: "testapikey",
  baseUrl: "https://retroachievements.org/API",
};

const RA_GAME_POKEMON_EMERALD = 7173;
const RA_GAME_ARIA_OF_SORROW = 3354;
const RA_GAME_FINAL_FANTASY_TACTICS = 2787;

function makeProfileResponse() {
  return Response.json({
    Username: "Derek",
    TotalPoints: 4200,
    TotalSoftcorePoints: 600,
    Rank: 42,
    RecentlyPlayedCount: 3,
  });
}

function makeProgressResponse() {
  return Response.json({
    Count: 3,
    Total: 3,
    Results: [
      {
        GameID: RA_GAME_POKEMON_EMERALD,
        Title: "Pokemon Emerald",
        ConsoleID: 5,
        ConsoleName: "Game Boy Advance",
        ImageIcon: "/Images/051168.png",
        NumPossibleAchievements: 48,
        NumAchieved: 44,
        NumAchievedHardcore: 40,
      },
      {
        GameID: RA_GAME_ARIA_OF_SORROW,
        Title: "Castlevania: Aria of Sorrow",
        ConsoleID: 5,
        ConsoleName: "Game Boy Advance",
        ImageIcon: "/Images/051169.png",
        NumPossibleAchievements: 50,
        NumAchieved: 50,
        NumAchievedHardcore: 50,
      },
      {
        GameID: RA_GAME_FINAL_FANTASY_TACTICS,
        Title: "Final Fantasy Tactics Advance",
        ConsoleID: 5,
        ConsoleName: "Game Boy Advance",
        ImageIcon: "/Images/051170.png",
        NumPossibleAchievements: 52,
        NumAchieved: 24,
        NumAchievedHardcore: 10,
      },
    ],
  });
}

function makeFetchImpl() {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("API_GetUserSummary")) return makeProfileResponse();
    if (url.includes("API_GetUserCompletionProgress")) return makeProgressResponse();
    return new Response(null, { status: 404 });
  };
}

function createService(canonicalGameResolver?: (retroGameId: number, gameTitle: string) => string | undefined) {
  const provider = new RetroAchievementsProvider({
    config: testConfig,
    fetchImpl: makeFetchImpl(),
  });
  const achievementService = new AchievementService();
  const masteryEngine = new RetroMasteryEngine();

  return new RetroAchievementService({
    provider,
    achievementService,
    masteryEngine,
    canonicalGameResolver,
  });
}

test("RetroAchievementService.syncUser fetches profile and stores achievement progress", async () => {
  const service = createService();
  const result = await service.syncUser("user-1", "Derek");

  assert.equal(result.userId, "user-1");
  assert.equal(result.username, "Derek");
  assert.equal(result.profile.points, 4200);
  assert.ok(result.syncedGames >= 0);
  assert.ok(result.skippedGames >= 0);
  assert.equal(result.syncedGames + result.skippedGames, 3);
});

test("RetroAchievementService.syncUser stores progress for all 3 games on supported platform", async () => {
  const canonicalGameResolver = (retroGameId: number) => {
    const map: Record<number, string> = {
      [RA_GAME_POKEMON_EMERALD]: "game-pokemon-emerald",
      [RA_GAME_ARIA_OF_SORROW]: "game-aria-of-sorrow",
      [RA_GAME_FINAL_FANTASY_TACTICS]: "game-final-fantasy-tactics-advance",
    };
    return map[retroGameId];
  };

  const service = createService(canonicalGameResolver);
  const result = await service.syncUser("user-2", "Derek");

  assert.equal(result.syncedGames, 3);
  assert.equal(result.skippedGames, 0);
});

test("RetroAchievementService.getProgress returns enriched progress after sync", async () => {
  const canonicalGameResolver = (retroGameId: number) => {
    const map: Record<number, string> = {
      [RA_GAME_POKEMON_EMERALD]: "game-pokemon-emerald",
      [RA_GAME_ARIA_OF_SORROW]: "game-aria-of-sorrow",
      [RA_GAME_FINAL_FANTASY_TACTICS]: "game-final-fantasy-tactics-advance",
    };
    return map[retroGameId];
  };

  const service = createService(canonicalGameResolver);
  await service.syncUser("user-3", "Derek");

  const progress = service.getProgress("user-3");
  assert.equal(progress.length, 3);

  const emerald = progress.find((p) => p.canonicalGameId === "game-pokemon-emerald");
  assert.ok(emerald, "Pokemon Emerald should be in progress");
  assert.equal(emerald.retroAchievementsGameId, RA_GAME_POKEMON_EMERALD);
  assert.equal(emerald.totalAchievements, 48);
  assert.equal(emerald.unlockedAchievements, 44);
  assert.equal(emerald.hardcoreUnlockedAchievements, 40);
  assert.ok(emerald.completionPercentage > 0);
  assert.ok(emerald.hardcoreCompletionPercentage > 0);
  assert.ok(emerald.masteryStatus !== undefined);
});

test("RetroAchievementService.getMastered returns only mastered retro games", async () => {
  const canonicalGameResolver = (retroGameId: number) => {
    const map: Record<number, string> = {
      [RA_GAME_POKEMON_EMERALD]: "game-pokemon-emerald",
      [RA_GAME_ARIA_OF_SORROW]: "game-aria-of-sorrow",
      [RA_GAME_FINAL_FANTASY_TACTICS]: "game-final-fantasy-tactics-advance",
    };
    return map[retroGameId];
  };

  const service = createService(canonicalGameResolver);
  await service.syncUser("user-4", "Derek");

  const mastered = service.getMastered("user-4");
  // Aria of Sorrow has 50/50 achievements = 100% = Mastered
  assert.ok(mastered.some((p) => p.canonicalGameId === "game-aria-of-sorrow"));
  // Pokemon Emerald at ~92% should NOT be mastered
  assert.ok(!mastered.some((p) => p.canonicalGameId === "game-pokemon-emerald"));
});

test("RetroAchievementService.getNearCompletion returns games in 85–99% range", async () => {
  const canonicalGameResolver = (retroGameId: number) => {
    const map: Record<number, string> = {
      [RA_GAME_POKEMON_EMERALD]: "game-pokemon-emerald",
      [RA_GAME_ARIA_OF_SORROW]: "game-aria-of-sorrow",
      [RA_GAME_FINAL_FANTASY_TACTICS]: "game-final-fantasy-tactics-advance",
    };
    return map[retroGameId];
  };

  const service = createService(canonicalGameResolver);
  await service.syncUser("user-5", "Derek");

  const nearCompletion = service.getNearCompletion("user-5");
  // Pokemon Emerald: 44/48 ≈ 92% → near completion
  assert.ok(nearCompletion.some((p) => p.canonicalGameId === "game-pokemon-emerald"));
  // Final Fantasy Tactics: 24/52 ≈ 46% → not near completion
  assert.ok(!nearCompletion.some((p) => p.canonicalGameId === "game-final-fantasy-tactics-advance"));
});

test("RetroAchievementService.syncUser requires non-empty userId", async () => {
  const service = createService();

  await assert.rejects(() => service.syncUser("", "Derek"));
});

test("RetroAchievementService.syncUser requires non-empty raUsername", async () => {
  const service = createService();

  await assert.rejects(() => service.syncUser("user-1", ""));
});
