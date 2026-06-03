import assert from "node:assert/strict";
import test from "node:test";

import { SteamGameMatcher } from "@/lib/steam/game-matcher";

const matcher = new SteamGameMatcher();

test("SteamGameMatcher prioritizes Steam app id mapping", () => {
  const match = matcher.match({
    appId: 1113000,
    title: "Persona 4 Golden",
    totalPlaytimeMinutes: 120,
  });

  assert.ok(match);
  assert.equal(match.strategy, "steam_app_id");
  assert.equal(match.game.id, "game-persona-4-golden");
});

test("SteamGameMatcher supports exact and alias title matching", () => {
  const exact = matcher.match({
    appId: 999999999,
    title: "Yakuza 0",
    totalPlaytimeMinutes: 0,
  });

  assert.ok(exact);
  assert.equal(exact.strategy, "exact_title");
  assert.equal(exact.game.id, "game-yakuza-0");

  const alias = matcher.match({
    appId: 999999998,
    title: "P4G",
    totalPlaytimeMinutes: 0,
  });

  assert.ok(alias);
  assert.equal(alias.strategy, "alias");
  assert.equal(alias.game.id, "game-persona-4-golden");
});

test("SteamGameMatcher applies franchise validation and avoids false positives", () => {
  const franchise = matcher.match({
    appId: 999999997,
    title: "Final Fantasy Tactics Lions Edition",
    totalPlaytimeMinutes: 0,
  });

  assert.ok(franchise);
  assert.equal(franchise.strategy, "franchise_validation");
  assert.equal(franchise.game.id, "game-final-fantasy-tactics-wotl");

  const unmatched = matcher.match({
    appId: 999999996,
    title: "Completely Unknown Adventure",
    totalPlaytimeMinutes: 0,
  });

  assert.equal(unmatched, undefined);
});
