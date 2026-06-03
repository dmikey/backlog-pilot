import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryLibraryRepository } from "@/lib/library/repository";
import { LibraryValidationError, UserLibraryService } from "@/lib/library/service";

function createService() {
  return new UserLibraryService(createInMemoryLibraryRepository());
}

test("createLibrary and getLibrary initialize a per-user library", () => {
  const service = createService();
  const library = service.createLibrary("user-1");

  assert.equal(library.userId, "user-1");
  assert.equal(service.getLibrary("user-1")?.id, library.id);
});

test("addGame enforces canonical integration, supports platform ownership, and list/search/stats", () => {
  const service = createService();

  const added = service.addGame({
    userId: "user-1",
    canonicalGameId: "game-persona-4-golden",
    status: "Active",
    notes: "Started on handheld first",
    rating: 8.5,
    ownership: {
      platform: "psvita",
      platformGameId: "PCSE00120",
      source: "manual-import",
      ownershipType: "Physical",
    },
  });

  assert.equal(added.canonicalGame.id, "game-persona-4-golden");
  assert.equal(added.canonicalMetadata.gameId, "game-persona-4-golden");
  assert.equal(added.ownershipRecords.length, 1);

  const listed = service.listGames("user-1", { platform: "psvita" });
  assert.equal(listed.length, 1);

  const sameCanonicalSecondPlatform = service.addGame({
    userId: "user-1",
    canonicalGameId: "game-persona-4-golden",
    ownership: {
      platform: "steam",
      platformGameId: "1113000",
      source: "steam-import",
      ownershipType: "Digital",
    },
  });

  assert.equal(sameCanonicalSecondPlatform.game.id, added.game.id);
  assert.equal(sameCanonicalSecondPlatform.ownershipRecords.length, 2);

  const searched = service.searchGames("user-1", "handheld");
  assert.equal(searched.length, 1);

  const stats = service.getStats("user-1");
  assert.deepEqual(stats, {
    totalGames: 1,
    completedGames: 0,
    activeGames: 1,
    abandonedGames: 0,
    unplayedGames: 0,
  });
});

test("updateStatus, updateRating, and removeGame manage lifecycle", () => {
  const service = createService();

  const added = service.addGame({
    userId: "user-1",
    canonicalGameId: "game-yakuza-0",
    ownership: {
      platform: "steam",
      platformGameId: "638970",
      source: "steam-import",
      ownershipType: "Digital",
    },
  });

  const updatedStatus = service.updateStatus("user-1", added.game.id, "Completed");
  assert.equal(updatedStatus.game.status, "Completed");

  const updatedRating = service.updateRating("user-1", added.game.id, 9);
  assert.equal(updatedRating.game.rating, 9);

  service.removeGame("user-1", added.game.id);
  assert.equal(service.listGames("user-1").length, 0);
});

test("validation errors are thrown for unsupported platform and invalid canonical references", () => {
  const service = createService();

  assert.throws(
    () =>
      service.addGame({
        userId: "user-1",
        canonicalGameId: "missing-game",
        ownership: {
          platform: "steam",
          platformGameId: "123",
          source: "steam-import",
          ownershipType: "Digital",
        },
      }),
    (error) => {
      assert.ok(error instanceof LibraryValidationError);
      assert.match(error.message, /canonicalGameId validation failed/);
      return true;
    },
  );

  assert.throws(
    () =>
      service.addGame({
        userId: "user-1",
        canonicalGameId: "game-persona-4-golden",
        ownership: {
          platform: "xbox" as "steam",
          platformGameId: "123",
          source: "manual-import",
          ownershipType: "Digital",
        },
      }),
    (error) => {
      assert.ok(error instanceof LibraryValidationError);
      assert.match(error.message, /platform must be one of/);
      return true;
    },
  );
});
