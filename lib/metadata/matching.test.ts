import assert from "node:assert/strict";
import test from "node:test";

import { demoIgdbRecords } from "@/lib/metadata/igdb-provider";
import { normalizeForMatch, resolveCanonicalMatch } from "@/lib/metadata/matching";

test("normalizeForMatch normalizes punctuation and diacritics", () => {
  assert.equal(normalizeForMatch("Ryū ga Gotoku 0"), "ryu-ga-gotoku-0");
  assert.equal(normalizeForMatch("Persona 4: Golden"), "persona-4-golden");
});

test("resolveCanonicalMatch prioritizes exact title", () => {
  const match = resolveCanonicalMatch(
    {
      title: "Persona 4 Golden",
      aliases: ["P4G"],
      franchise: "Persona",
      releaseDate: "2012-06-14",
    },
    demoIgdbRecords,
  );

  assert.ok(match);
  assert.equal(match.strategy, "exact_title");
  assert.equal(match.game.id, 4573);
});

test("resolveCanonicalMatch supports alias match", () => {
  const match = resolveCanonicalMatch(
    {
      title: "Like a Dragon Zero",
      aliases: ["Ryū ga Gotoku 0"],
      releaseDate: "2015-03-12",
    },
    demoIgdbRecords,
  );

  assert.ok(match);
  assert.equal(match.strategy, "alias");
  assert.equal(match.game.id, 10952);
});

test("resolveCanonicalMatch uses franchise + similarity fallback", () => {
  const match = resolveCanonicalMatch(
    {
      title: "Monster Hunter Rise Deluxe",
      aliases: [],
      franchise: "Monster Hunter",
      releaseDate: "2021-03-26",
    },
    demoIgdbRecords,
  );

  assert.ok(match);
  assert.equal(match.strategy, "franchise_similarity");
  assert.equal(match.game.id, 114795);
});
