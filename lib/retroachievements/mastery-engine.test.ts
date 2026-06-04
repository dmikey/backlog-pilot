import assert from "node:assert/strict";
import test from "node:test";

import { RetroMasteryEngine } from "@/lib/retroachievements/mastery-engine";
import { RA_CONSOLE_GBA, RA_CONSOLE_SNES, RA_CONSOLE_PS1, RA_CONSOLE_GENESIS } from "@/lib/retroachievements/types";

test("RetroMasteryEngine.toPlatform maps RA console IDs to library platform IDs", () => {
  const engine = new RetroMasteryEngine();

  assert.equal(engine.toPlatform(RA_CONSOLE_GBA), "gba");
  assert.equal(engine.toPlatform(RA_CONSOLE_SNES), "snes");
  assert.equal(engine.toPlatform(RA_CONSOLE_PS1), "ps1");
  assert.equal(engine.toPlatform(RA_CONSOLE_GENESIS), "genesis");
  assert.equal(engine.toPlatform(99999), undefined);
});

test("RetroMasteryEngine.isSupportedPlatform returns true for known console IDs", () => {
  const engine = new RetroMasteryEngine();

  assert.equal(engine.isSupportedPlatform(RA_CONSOLE_GBA), true);
  assert.equal(engine.isSupportedPlatform(RA_CONSOLE_SNES), true);
  assert.equal(engine.isSupportedPlatform(99999), false);
});

test("RetroMasteryEngine.toConsoleIds returns all console IDs for a platform", () => {
  const engine = new RetroMasteryEngine();
  const gbaConsoles = engine.toConsoleIds("gba");

  assert.ok(gbaConsoles.includes(RA_CONSOLE_GBA), "should include GBA console ID");
  assert.ok(gbaConsoles.length >= 1);
});

test("RetroMasteryEngine.toRetroProgressSignals calculates correct percentages", () => {
  const engine = new RetroMasteryEngine();

  const signals = engine.toRetroProgressSignals({
    retroAchievementsGameId: 7173,
    gameTitle: "Pokemon Emerald",
    consoleId: RA_CONSOLE_GBA,
    consoleName: "Game Boy Advance",
    imageIcon: "",
    totalAchievements: 48,
    numAwardedToUser: 42,
    numAwardedToUserHardcore: 38,
    percentComplete: 88,
    percentCompleteHardcore: 79,
  });

  assert.equal(signals.retroCompletionPercentage, 87.5);
  assert.equal(signals.hardcoreCompletionPercentage, 79.17);
  assert.ok(signals.retroEngagementScore > 0, "engagement score should be positive");
  assert.ok(signals.retroEngagementScore <= 1, "engagement score should be <= 1");
  assert.ok(signals.masteryOpportunityScore > 0, "near-complete game should have opportunity score");
});

test("RetroMasteryEngine.toRetroProgressSignals handles 100% completion", () => {
  const engine = new RetroMasteryEngine();

  const signals = engine.toRetroProgressSignals({
    retroAchievementsGameId: 1,
    gameTitle: "Mastered Game",
    consoleId: RA_CONSOLE_GBA,
    consoleName: "GBA",
    imageIcon: "",
    totalAchievements: 52,
    numAwardedToUser: 52,
    numAwardedToUserHardcore: 52,
    percentComplete: 100,
    percentCompleteHardcore: 100,
  });

  assert.equal(signals.retroCompletionPercentage, 100);
  assert.equal(signals.hardcoreCompletionPercentage, 100);
  assert.equal(signals.masteryOpportunityScore, 0, "completed game should have no opportunity gap");
});

test("RetroMasteryEngine.toRetroProgressSignals handles zero achievements", () => {
  const engine = new RetroMasteryEngine();

  const signals = engine.toRetroProgressSignals({
    retroAchievementsGameId: 2,
    gameTitle: "No Achievements Game",
    consoleId: RA_CONSOLE_GBA,
    consoleName: "GBA",
    imageIcon: "",
    totalAchievements: 0,
    numAwardedToUser: 0,
    numAwardedToUserHardcore: 0,
    percentComplete: 0,
    percentCompleteHardcore: 0,
  });

  assert.equal(signals.retroCompletionPercentage, 0);
  assert.equal(signals.retroEngagementScore, 0);
});

test("RetroMasteryEngine.toRetroProgressSignals gives extra weight to hardcore completions", () => {
  const engine = new RetroMasteryEngine();

  const softcoreOnly = engine.toRetroProgressSignals({
    retroAchievementsGameId: 3,
    gameTitle: "Softcore Game",
    consoleId: RA_CONSOLE_GBA,
    consoleName: "GBA",
    imageIcon: "",
    totalAchievements: 50,
    numAwardedToUser: 40,
    numAwardedToUserHardcore: 0,
    percentComplete: 80,
    percentCompleteHardcore: 0,
  });

  const hardcorePlayer = engine.toRetroProgressSignals({
    retroAchievementsGameId: 4,
    gameTitle: "Hardcore Game",
    consoleId: RA_CONSOLE_GBA,
    consoleName: "GBA",
    imageIcon: "",
    totalAchievements: 50,
    numAwardedToUser: 40,
    numAwardedToUserHardcore: 40,
    percentComplete: 80,
    percentCompleteHardcore: 80,
  });

  assert.ok(
    hardcorePlayer.retroEngagementScore > softcoreOnly.retroEngagementScore,
    "hardcore progress should yield higher engagement score",
  );
});
