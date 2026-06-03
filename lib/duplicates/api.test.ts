import assert from "node:assert/strict";
import test from "node:test";

import { GET as getDuplicates } from "@/app/api/duplicates/route";
import { GET as getDuplicateGroups } from "@/app/api/duplicates/groups/route";
import { GET as getDuplicateSummary } from "@/app/api/duplicates/summary/route";
import { GET as getDuplicateByGame } from "@/app/api/duplicates/[gameId]/route";
import { POST as postLibraryGame } from "@/app/api/library/games/route";
import { resetUserLibraryServiceForTests } from "@/lib/library/container";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("duplicate endpoints return groups, summary, and game details", async () => {
  resetUserLibraryServiceForTests();

  await postLibraryGame(
    jsonRequest("http://localhost/api/library/games", "POST", {
      userId: "user-1",
      canonicalGameId: "game-persona-4-golden",
      ownership: {
        platform: "steam",
        platformGameId: "1113000",
        source: "steam-import",
        ownershipType: "Digital",
      },
    }),
  );

  await postLibraryGame(
    jsonRequest("http://localhost/api/library/games", "POST", {
      userId: "user-1",
      canonicalGameId: "game-persona-4-golden",
      ownership: {
        platform: "psvita",
        platformGameId: "PCSE00120",
        source: "manual-import",
        ownershipType: "Physical",
      },
    }),
  );

  const duplicatesResponse = await getDuplicates(new Request("http://localhost/api/duplicates?userId=user-1"));
  assert.equal(duplicatesResponse.status, 200);
  const duplicatesPayload = (await duplicatesResponse.json()) as {
    groups: Array<{ canonicalGameId: string; duplicateCount: number; preferredPlatform: string }>;
  };
  assert.equal(duplicatesPayload.groups.length, 1);
  assert.equal(duplicatesPayload.groups[0]?.duplicateCount, 2);

  const groupsResponse = await getDuplicateGroups(
    new Request("http://localhost/api/duplicates/groups?userId=user-1"),
  );
  assert.equal(groupsResponse.status, 200);
  const groupsPayload = (await groupsResponse.json()) as { groups: unknown[] };
  assert.equal(groupsPayload.groups.length, 1);

  const summaryResponse = await getDuplicateSummary(
    new Request("http://localhost/api/duplicates/summary?userId=user-1"),
  );
  assert.equal(summaryResponse.status, 200);
  const summaryPayload = (await summaryResponse.json()) as {
    summary: { totalDuplicateGames: number; duplicateOwnershipPercentage: number };
  };
  assert.equal(summaryPayload.summary.totalDuplicateGames, 1);
  assert.equal(summaryPayload.summary.duplicateOwnershipPercentage, 100);

  const gameResponse = await getDuplicateByGame(
    new Request("http://localhost/api/duplicates/game-persona-4-golden?userId=user-1"),
    { params: Promise.resolve({ gameId: "game-persona-4-golden" }) },
  );
  assert.equal(gameResponse.status, 200);
  const gamePayload = (await gameResponse.json()) as {
    ownershipCount: number;
    platforms: string[];
    preferredPlatform: string;
  };
  assert.equal(gamePayload.ownershipCount, 2);
  assert.equal(gamePayload.platforms.includes("Steam"), true);
  assert.equal(gamePayload.platforms.includes("PSVita"), true);
});

test("duplicate endpoints validate required userId", async () => {
  resetUserLibraryServiceForTests();

  const missingUserResponse = await getDuplicates(new Request("http://localhost/api/duplicates"));
  assert.equal(missingUserResponse.status, 400);
});
