import assert from "node:assert/strict";
import test from "node:test";

import { DuplicateOwnershipService } from "@/lib/duplicates/duplicate-ownership-service";
import { OwnershipGroupService } from "@/lib/duplicates/ownership-group-service";
import type { Game, GameMetadata } from "@/lib/domain/types";
import {
  createInMemoryLibraryRepository,
} from "@/lib/library/repository";
import { UserLibraryService } from "@/lib/library/service";
import type { LibraryGameWithOwnership, SupportedLibraryPlatform } from "@/lib/library/types";

function createOwnershipEntry(
  game: Game,
  metadata: GameMetadata,
  ownershipPlatforms: SupportedLibraryPlatform[],
): LibraryGameWithOwnership {
  return {
    game: {
      id: `${game.id}-library`,
      userId: "user-1",
      canonicalGameId: game.id,
      status: "Unplayed",
      playtimeHours: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    ownershipRecords: ownershipPlatforms.map((platform, index) => ({
      id: `${game.id}-${platform}-${index}`,
      libraryGameId: `${game.id}-library`,
      platform,
      platformGameId: `${game.id}-${platform}`,
      source: `${platform}-import`,
      ownershipType: "Digital",
    })),
    canonicalGame: game,
    canonicalMetadata: metadata,
  };
}

function createGame(id: string, title: string, editionKind: Game["edition"]["kind"], franchiseId = "fr-test"): Game {
  return {
    id,
    canonicalTitle: title,
    normalizedTitle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    aliases: [],
    normalizedAliases: [],
    franchiseId,
    seriesId: `${franchiseId}-series`,
    description: `${title} description`,
    releaseDate: "2020-01-01",
    developer: ["Test Studio"],
    publisher: ["Test Publisher"],
    genres: [{ id: "genre-rpg", name: "RPG" }],
    tags: [{ id: "tag-test", name: "Test" }],
    coverArt: { url: "https://example.com/cover.jpg", alt: `${title} cover` },
    screenshots: [],
    edition: {
      kind: editionKind,
      label: title,
      canonicalEditionKey: `${id}-edition`,
    },
  };
}

function createMetadata(gameId: string, duplicateDetectionKey: string): GameMetadata {
  return {
    gameId,
    externalIds: {},
    aliasMatchKeys: [],
    editionMatchKeys: [],
    duplicateDetectionKey,
    completionTimeHours: { main: 20 },
    estimatedHours: 20,
    completionLikelihood: "medium",
    mood: "Test mood",
  };
}

test("OwnershipGroupService groups same canonical ownership and scores high severity", () => {
  const game = createGame("game-persona-4-golden", "Persona 4 Golden", "definitive", "fr-persona");
  const metadata = createMetadata(game.id, "persona-4-golden");
  const entry = createOwnershipEntry(game, metadata, ["steam", "psvita", "nintendo-switch"]);

  const groups = new OwnershipGroupService().group([entry], {
    preferredPlatforms: ["nintendo-switch", "steam"],
  });

  assert.equal(groups.length, 1);
  const group = groups[0];
  assert.ok(group);
  assert.equal(group.duplicateCount, 3);
  assert.equal(group.preferredPlatform, "nintendo-switch");
  assert.equal(group.duplicateScore, "High");
});

test("OwnershipGroupService matches remaster and definitive editions into duplicate families", () => {
  const skyrim = createGame("game-skyrim", "The Elder Scrolls V: Skyrim", "standard", "fr-elder-scrolls");
  const skyrimSpecial = createGame(
    "game-skyrim-special",
    "The Elder Scrolls V: Skyrim Special Edition",
    "definitive",
    "fr-elder-scrolls",
  );
  const re4 = createGame("game-re4", "Resident Evil 4", "standard", "fr-resident-evil");
  const re4Remake = createGame("game-re4-remake", "Resident Evil 4 Remake", "remaster", "fr-resident-evil");

  const grouped = new OwnershipGroupService().group([
    createOwnershipEntry(skyrim, createMetadata(skyrim.id, "elder-scrolls-v-skyrim"), ["steam"]),
    createOwnershipEntry(
      skyrimSpecial,
      createMetadata(skyrimSpecial.id, "elder-scrolls-v-skyrim-special-edition"),
      ["nintendo-switch"],
    ),
    createOwnershipEntry(re4, createMetadata(re4.id, "resident-evil-4"), ["steam"]),
    createOwnershipEntry(re4Remake, createMetadata(re4Remake.id, "resident-evil-4-remake"), ["psvita"]),
  ]);

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0]?.duplicateCount, 2);
  assert.equal(grouped[1]?.duplicateCount, 2);
  assert.equal(grouped[0]?.duplicateScore, "Low");
  assert.equal(grouped[1]?.duplicateScore, "Low");
});

test("DuplicateOwnershipService supports collection ownership relationships and signals", () => {
  const meCollection = createGame(
    "game-mass-effect-legendary",
    "Mass Effect Legendary Edition",
    "collection",
    "fr-mass-effect",
  );
  const me1 = createGame("game-mass-effect-1", "Mass Effect", "standard", "fr-mass-effect");
  const me2 = createGame("game-mass-effect-2", "Mass Effect 2", "standard", "fr-mass-effect");

  const service = new UserLibraryService(createInMemoryLibraryRepository(), {
    getGameById(gameId) {
      return [meCollection, me1, me2].find((game) => game.id === gameId);
    },
    getMetadataByGameId(gameId) {
      return {
        [meCollection.id]: createMetadata(meCollection.id, "mass-effect-legendary-edition"),
        [me1.id]: createMetadata(me1.id, "mass-effect"),
        [me2.id]: createMetadata(me2.id, "mass-effect-2"),
      }[gameId];
    },
  });

  service.addGame({
    userId: "user-1",
    canonicalGameId: meCollection.id,
    ownership: {
      platform: "steam",
      platformGameId: "1328670",
      source: "steam-import",
      ownershipType: "Digital",
    },
  });

  service.addGame({
    userId: "user-1",
    canonicalGameId: me1.id,
    ownership: {
      platform: "nintendo-switch",
      platformGameId: "me1-switch",
      source: "manual-import",
      ownershipType: "Physical",
    },
  });

  service.addGame({
    userId: "user-1",
    canonicalGameId: me2.id,
    ownership: {
      platform: "psvita",
      platformGameId: "me2-vita",
      source: "manual-import",
      ownershipType: "Digital",
    },
  });

  const duplicateService = new DuplicateOwnershipService(service);
  const groups = duplicateService.getDuplicateGroups("user-1", {
    preferredPlatforms: ["nintendo-switch", "steam"],
    collectionComponentsByGameId: {
      [meCollection.id]: [me1.id, me2.id],
    },
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.duplicateCount, 3);
  assert.equal(groups[0]?.preferredPlatform, "nintendo-switch");

  const purchaseSignal = duplicateService.getPurchaseSignal("user-1", me1.id, {
    collectionComponentsByGameId: {
      [meCollection.id]: [me1.id, me2.id],
    },
  });
  assert.equal(purchaseSignal.recommendation, "Skip");

  const recommendationSignals = duplicateService.getRecommendationSignals("user-1", {
    collectionComponentsByGameId: {
      [meCollection.id]: [me1.id, me2.id],
    },
  });
  assert.equal(recommendationSignals.length, 1);
  assert.equal(recommendationSignals[0]?.duplicateScore, "High");
});
