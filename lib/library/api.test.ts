import assert from "node:assert/strict";
import test from "node:test";

import { GET as getLibrary } from "@/app/api/library/route";
import { POST as postLibraryGame, GET as listLibraryGames } from "@/app/api/library/games/route";
import { PATCH as patchLibraryGame, DELETE as deleteLibraryGame } from "@/app/api/library/games/[id]/route";
import { GET as getLibraryStats } from "@/app/api/library/stats/route";
import { resetUserLibraryServiceForTests } from "@/lib/library/container";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("library API supports create/list/update/delete/stats flow", async () => {
  resetUserLibraryServiceForTests();

  const libraryResponse = await getLibrary(new Request("http://localhost/api/library?userId=user-1"));
  assert.equal(libraryResponse.status, 200);

  const createResponse = await postLibraryGame(
    jsonRequest("http://localhost/api/library/games", "POST", {
      userId: "user-1",
      canonicalGameId: "game-monster-hunter-rise",
      status: "Unplayed",
      ownership: {
        platform: "nintendo-switch",
        platformGameId: "0100559011740000",
        source: "switch-import",
        ownershipType: "Digital",
      },
    }),
  );

  assert.equal(createResponse.status, 201);
  const createPayload = (await createResponse.json()) as { game: { game: { id: string } } };
  const gameId = createPayload.game.game.id;

  const listResponse = await listLibraryGames(
    new Request("http://localhost/api/library/games?userId=user-1&status=Unplayed"),
  );

  assert.equal(listResponse.status, 200);
  const listPayload = (await listResponse.json()) as { games: Array<{ game: { id: string } }> };
  assert.equal(listPayload.games.length, 1);
  assert.equal(listPayload.games[0]?.game.id, gameId);

  const patchResponse = await patchLibraryGame(
    jsonRequest(`http://localhost/api/library/games/${gameId}?userId=user-1`, "PATCH", {
      status: "Completed",
      rating: 9,
      notes: "Finished campaign",
    }),
    { params: Promise.resolve({ id: gameId }) },
  );

  assert.equal(patchResponse.status, 200);

  const statsResponse = await getLibraryStats(
    new Request("http://localhost/api/library/stats?userId=user-1"),
  );
  const statsPayload = (await statsResponse.json()) as {
    stats: {
      totalGames: number;
      completedGames: number;
      activeGames: number;
      abandonedGames: number;
      unplayedGames: number;
    };
  };

  assert.equal(statsResponse.status, 200);
  assert.deepEqual(statsPayload.stats, {
    totalGames: 1,
    completedGames: 1,
    activeGames: 0,
    abandonedGames: 0,
    unplayedGames: 0,
  });

  const deleteResponse = await deleteLibraryGame(
    new Request(`http://localhost/api/library/games/${gameId}?userId=user-1`, { method: "DELETE" }),
    { params: Promise.resolve({ id: gameId }) },
  );

  assert.equal(deleteResponse.status, 204);

  const afterDeleteList = await listLibraryGames(new Request("http://localhost/api/library/games?userId=user-1"));
  const afterDeletePayload = (await afterDeleteList.json()) as { games: unknown[] };
  assert.equal(afterDeletePayload.games.length, 0);
});

test("library API validates required userId and malformed payloads", async () => {
  resetUserLibraryServiceForTests();

  const missingUserResponse = await getLibrary(new Request("http://localhost/api/library"));
  assert.equal(missingUserResponse.status, 400);

  const invalidPayloadResponse = await postLibraryGame(
    new Request("http://localhost/api/library/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ bad json",
    }),
  );

  assert.equal(invalidPayloadResponse.status, 400);
});
