import test from "node:test";
import assert from "node:assert/strict";

import {
  demoGameMetadata,
  demoGames,
  demoLibraryEntries,
  demoPlatformEntries,
} from "@/lib/demo-data";
import {
  RecommendationScoringEngine,
  type RecommendationScoringContext,
  type ScoringCandidate,
} from "@/lib/recommendations/scoring";

function getCandidate(entryId: string): ScoringCandidate {
  const libraryEntry = demoLibraryEntries.find((entry) => entry.id === entryId);
  assert.ok(libraryEntry, `Missing library entry: ${entryId}`);

  const game = demoGames.find((candidate) => candidate.id === libraryEntry.gameId);
  assert.ok(game, `Missing game: ${libraryEntry.gameId}`);

  const metadata = demoGameMetadata.find((candidate) => candidate.gameId === libraryEntry.gameId);
  assert.ok(metadata, `Missing metadata: ${libraryEntry.gameId}`);

  const platformEntry = libraryEntry.platformEntryId
    ? demoPlatformEntries.find((entry) => entry.id === libraryEntry.platformEntryId)
    : undefined;

  return {
    game,
    metadata,
    libraryEntry,
    platformEntry,
  };
}

function getContext(): RecommendationScoringContext {
  const activeRotation = ["entry-persona-4-steam", "entry-yakuza-0-steam"].map(getCandidate);

  return {
    preferredPlatforms: ["nintendo-switch", "psp", "steam", "psvita", "gba"],
    targetSessionMinutes: 60,
    activeRotation,
    allLibraryEntries: demoLibraryEntries,
  };
}

test("scores are deterministic for the same input", () => {
  const engine = new RecommendationScoringEngine();
  const candidate = getCandidate("entry-monster-hunter-rise-switch");
  const context = getContext();

  const firstScore = engine.score(candidate, context);
  const secondScore = engine.score(candidate, context);

  assert.deepEqual(secondScore, firstScore);
});

test("weights are configurable and influence score output", () => {
  const backlogFocusedEngine = new RecommendationScoringEngine({
    weights: {
      completionProbability: 0,
      backlogAge: 1,
      genreDiversity: 0,
      platformPreference: 0,
      sessionFit: 0,
      ownershipDuplication: 0,
      activeRotationFit: 0,
    },
  });

  const oldBacklogScore = backlogFocusedEngine.score(
    getCandidate("entry-final-fantasy-tactics-wotl-psp"),
    getContext(),
  );
  const recentBacklogScore = backlogFocusedEngine.score(getCandidate("entry-yakuza-0-steam"), getContext());

  assert.ok(oldBacklogScore.score > recentBacklogScore.score);
});

test("output includes explainable reasons and full factor breakdown", () => {
  const engine = new RecommendationScoringEngine();
  const score = engine.score(getCandidate("entry-final-fantasy-tactics-wotl-psp"), getContext());

  assert.ok(score.reasons.length > 0);
  assert.ok(score.confidence > 0);
  assert.deepEqual(Object.keys(score.factors).sort(), [
    "activeRotationFit",
    "backlogAge",
    "completionProbability",
    "genreDiversity",
    "ownershipDuplication",
    "platformPreference",
    "sessionFit",
  ]);
});

test("engine scores entries across Steam, Switch, GBA, PSP, and PSVita", () => {
  const engine = new RecommendationScoringEngine();
  const context = getContext();
  const platformIds = new Set(["steam", "nintendo-switch", "gba", "psp", "psvita"]);

  for (const platformId of platformIds) {
    const entry = demoLibraryEntries.find((candidate) => candidate.platformId === platformId);
    assert.ok(entry, `Missing demo entry for ${platformId}`);

    const result = engine.score(getCandidate(entry.id), context);
    assert.ok(result.score >= 0 && result.score <= 100);
  }
});
