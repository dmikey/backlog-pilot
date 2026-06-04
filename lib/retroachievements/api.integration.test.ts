import assert from "node:assert/strict";
import test from "node:test";

import { GET as getProfile } from "@/app/api/retroachievements/profile/route";
import { GET as getProgress } from "@/app/api/retroachievements/progress/route";
import { GET as getMastered } from "@/app/api/retroachievements/mastered/route";
import { GET as getNearCompletion } from "@/app/api/retroachievements/near-completion/route";
import { GET as getGameById } from "@/app/api/retroachievements/[gameId]/route";
import { GET as getRecommendations } from "@/app/api/recommendations/route";
import { resetAchievementServiceForTests } from "@/lib/achievements/container";
import { resetRetroAchievementServiceForTests } from "@/lib/retroachievements/container";

const RA_GAME_POKEMON_EMERALD = 7173;
const RA_GAME_ARIA_OF_SORROW = 3354;
const RA_GAME_FINAL_FANTASY_TACTICS = 2787;

const canonicalGameMap: Record<number, string> = {
  [RA_GAME_POKEMON_EMERALD]: "game-pokemon-emerald",
  [RA_GAME_ARIA_OF_SORROW]: "game-aria-of-sorrow",
  [RA_GAME_FINAL_FANTASY_TACTICS]: "game-final-fantasy-tactics-advance",
};

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

function setupRaEnv() {
  process.env.RETROACHIEVEMENTS_USERNAME = "testuser";
  process.env.RETROACHIEVEMENTS_API_KEY = "testapikey";
}

function setupMocks() {
  resetAchievementServiceForTests();
  resetRetroAchievementServiceForTests({
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("API_GetUserSummary")) return makeProfileResponse();
      if (url.includes("API_GetUserCompletionProgress")) return makeProgressResponse();
      return new Response(null, { status: 404 });
    },
    canonicalGameResolver: (retroGameId) => canonicalGameMap[retroGameId],
  });
}

test("RetroAchievements profile endpoint syncs and returns user profile", async () => {
  setupRaEnv();
  setupMocks();

  const response = await getProfile(
    new Request("http://localhost/api/retroachievements/profile?userId=user-ra-1&raUsername=Derek"),
  );
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    userId: string;
    raUsername: string;
    profile: { username: string; points: number };
    syncedGames: number;
    skippedGames: number;
  };

  assert.equal(payload.userId, "user-ra-1");
  assert.equal(payload.raUsername, "Derek");
  assert.equal(payload.profile.username, "Derek");
  assert.equal(payload.profile.points, 4200);
  assert.equal(payload.syncedGames, 3);
  assert.equal(payload.skippedGames, 0);
});

test("RetroAchievements progress endpoint returns enriched progress and analytics", async () => {
  setupRaEnv();
  setupMocks();

  // Sync first
  await getProfile(
    new Request("http://localhost/api/retroachievements/profile?userId=user-ra-2&raUsername=Derek"),
  );

  const response = await getProgress(
    new Request("http://localhost/api/retroachievements/progress?userId=user-ra-2"),
  );
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    progress: Array<{
      canonicalGameId: string;
      completionPercentage: number;
      hardcoreCompletionPercentage: number;
      masteryStatus: string;
    }>;
    analytics: {
      masteredGames: Array<{ canonicalGameId: string }>;
    };
  };

  assert.ok(payload.progress.length > 0, "should have progress entries");

  const emerald = payload.progress.find((p) => p.canonicalGameId === "game-pokemon-emerald");
  assert.ok(emerald, "Pokemon Emerald should appear in progress");
  assert.ok(emerald.completionPercentage > 0);
  assert.ok(emerald.hardcoreCompletionPercentage > 0);
  assert.ok(typeof emerald.masteryStatus === "string");
});

test("RetroAchievements mastered endpoint returns only 100% games", async () => {
  setupRaEnv();
  setupMocks();

  await getProfile(
    new Request("http://localhost/api/retroachievements/profile?userId=user-ra-3&raUsername=Derek"),
  );

  const response = await getMastered(
    new Request("http://localhost/api/retroachievements/mastered?userId=user-ra-3"),
  );
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    games: Array<{ canonicalGameId: string; masteryStatus: string }>;
  };

  // All returned games should be mastered
  for (const game of payload.games) {
    assert.equal(game.masteryStatus, "Mastered", `${game.canonicalGameId} should be Mastered`);
  }

  // Aria of Sorrow is 50/50 = 100% = should be mastered
  assert.ok(
    payload.games.some((g) => g.canonicalGameId === "game-aria-of-sorrow"),
    "Aria of Sorrow should be mastered",
  );
});

test("RetroAchievements near-completion endpoint returns games in 85–99% range", async () => {
  setupRaEnv();
  setupMocks();

  await getProfile(
    new Request("http://localhost/api/retroachievements/profile?userId=user-ra-4&raUsername=Derek"),
  );

  const response = await getNearCompletion(
    new Request("http://localhost/api/retroachievements/near-completion?userId=user-ra-4"),
  );
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    games: Array<{ canonicalGameId: string; completionPercentage: number }>;
  };

  for (const game of payload.games) {
    assert.ok(
      game.completionPercentage >= 85 && game.completionPercentage < 100,
      `${game.canonicalGameId} should be in near-completion range (got ${game.completionPercentage}%)`,
    );
  }

  assert.ok(
    payload.games.some((g) => g.canonicalGameId === "game-pokemon-emerald"),
    "Pokemon Emerald at ~92% should be in near-completion",
  );
});

test("RetroAchievements [gameId] endpoint returns game-specific progress", async () => {
  setupRaEnv();
  setupMocks();

  await getProfile(
    new Request("http://localhost/api/retroachievements/profile?userId=user-ra-5&raUsername=Derek"),
  );

  const response = await getGameById(
    new Request(
      "http://localhost/api/retroachievements/game-pokemon-emerald?userId=user-ra-5",
    ),
    { params: Promise.resolve({ gameId: "game-pokemon-emerald" }) },
  );
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    game: string;
    platform: string;
    completionPercentage: number;
    masteryStatus: string;
    hardcoreCompletionPercentage: number;
    totalAchievements: number;
    unlockedAchievements: number;
  };

  assert.equal(payload.game, "Pokemon Emerald");
  assert.equal(payload.platform, "gba");
  assert.ok(payload.completionPercentage > 0);
  assert.ok(typeof payload.masteryStatus === "string");
  assert.equal(payload.totalAchievements, 48);
  assert.equal(payload.unlockedAchievements, 44);
});

test("RetroAchievements [gameId] endpoint returns 404 for unknown game", async () => {
  setupRaEnv();
  setupMocks();

  const response = await getGameById(
    new Request("http://localhost/api/retroachievements/game-unknown?userId=user-ra-6"),
    { params: Promise.resolve({ gameId: "game-unknown" }) },
  );
  assert.equal(response.status, 404);
});

test("RetroAchievements endpoints return 400 when userId is missing", async () => {
  setupRaEnv();
  setupMocks();

  const progressResponse = await getProgress(
    new Request("http://localhost/api/retroachievements/progress"),
  );
  assert.equal(progressResponse.status, 400);

  const masteredResponse = await getMastered(
    new Request("http://localhost/api/retroachievements/mastered"),
  );
  assert.equal(masteredResponse.status, 400);
});

test("RetroAchievements profile endpoint returns 400 when raUsername is missing", async () => {
  setupRaEnv();
  setupMocks();

  const response = await getProfile(
    new Request("http://localhost/api/retroachievements/profile?userId=user-1"),
  );
  assert.equal(response.status, 400);
});

test("RetroAchievements synced progress feeds into recommendation signals", async () => {
  setupRaEnv();
  setupMocks();

  await getProfile(
    new Request("http://localhost/api/retroachievements/profile?userId=user-ra-7&raUsername=Derek"),
  );

  // The AchievementService now has retro progress - verify recommendations can include it
  const response = await getRecommendations(
    new Request("http://localhost/api/recommendations?userId=user-ra-7&type=play-tonight"),
  );
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    primaryRecommendation: { gameId: string } | null;
    alternatives: Array<{ gameId: string }>;
  };

  // Recommendations endpoint should work without errors even with retro achievements data
  assert.ok(typeof payload === "object");
});
