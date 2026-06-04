import assert from "node:assert/strict";
import test from "node:test";

import { GET as getRecommendations } from "@/app/api/recommendations/route";
import { POST as postRecommendationQuery } from "@/app/api/recommendations/query/route";
import { GET as getPlayTonightRecommendations } from "@/app/api/recommendations/play-tonight/route";
import { GET as getFranchiseRecommendations } from "@/app/api/recommendations/franchise/route";
import { GET as getBacklogRecommendations } from "@/app/api/recommendations/backlog/route";
import { GET as getShortSessionRecommendations } from "@/app/api/recommendations/short-session/route";
import { GET as getLongSessionRecommendations } from "@/app/api/recommendations/long-session/route";
import { POST as postLibraryGame } from "@/app/api/library/games/route";
import { resetUserLibraryServiceForTests } from "@/lib/library/container";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("recommendation API ranks deterministically, filters candidates, and returns confidence/factors", async () => {
  resetUserLibraryServiceForTests();

  for (const [canonicalGameId, status, platform, platformGameId] of [
    ["game-yakuza-0", "Unplayed", "steam", "638970"],
    ["game-yakuza-kiwami", "Unplayed", "steam", "834530"],
    ["game-persona-5-royal", "Active", "steam", "P5R"],
    ["game-monster-hunter-rise", "Unplayed", "nintendo-switch", "0100B04011742000"],
  ] as const) {
    const response = await postLibraryGame(
      jsonRequest("http://localhost/api/library/games", "POST", {
        userId: "user-rec-1",
        canonicalGameId,
        status,
        ownership: {
          platform,
          platformGameId,
          source: "manual-import",
          ownershipType: "Digital",
        },
      }),
    );

    assert.equal(response.status, 201);
  }

  const response = await getRecommendations(
    new Request(
      "http://localhost/api/recommendations?userId=user-rec-1&type=play-tonight&platform=steam&maxEstimatedHours=80",
    ),
  );
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    primaryRecommendation: {
      gameId: string;
      platform: string;
      score: number;
      confidence: number;
      factorBreakdown: { sessionFit: number };
      explanation: { whyThisGame: string[] };
    } | null;
    alternatives: Array<{ score: number; platform: string }>;
  };

  assert.ok(payload.primaryRecommendation);
  assert.equal(payload.primaryRecommendation?.platform, "steam");
  assert.ok((payload.primaryRecommendation?.score ?? 0) >= 0);
  assert.ok((payload.primaryRecommendation?.score ?? 0) <= 100);
  assert.ok((payload.primaryRecommendation?.confidence ?? 0) >= 0);
  assert.ok((payload.primaryRecommendation?.confidence ?? 0) <= 1);
  assert.ok((payload.primaryRecommendation?.factorBreakdown.sessionFit ?? 0) >= 0);
  assert.ok((payload.primaryRecommendation?.explanation.whyThisGame.length ?? 0) > 0);
  assert.ok(payload.alternatives.every((entry) => entry.platform === "steam"));

  for (let index = 1; index < payload.alternatives.length; index += 1) {
    assert.ok(payload.alternatives[index - 1]!.score >= payload.alternatives[index]!.score);
  }

  const deterministicResponse = await getRecommendations(
    new Request(
      "http://localhost/api/recommendations?userId=user-rec-1&type=play-tonight&platform=steam&maxEstimatedHours=80",
    ),
  );

  const deterministicPayload = (await deterministicResponse.json()) as {
    primaryRecommendation: { gameId: string; score: number } | null;
  };

  assert.equal(deterministicPayload.primaryRecommendation?.gameId, payload.primaryRecommendation?.gameId);
  assert.equal(deterministicPayload.primaryRecommendation?.score, payload.primaryRecommendation?.score);
});

test("recommendation endpoints return typed responses for scenario and query routes", async () => {
  resetUserLibraryServiceForTests();

  for (const [canonicalGameId, status, platform, platformGameId] of [
    ["game-persona-3-portable", "Completed", "psp", "ULUS-10432"],
    ["game-persona-4-golden", "Completed", "steam", "1113000"],
    ["game-persona-5-royal", "Unplayed", "steam", "P5R"],
    ["game-yakuza-kiwami", "Unplayed", "steam", "834530"],
  ] as const) {
    const response = await postLibraryGame(
      jsonRequest("http://localhost/api/library/games", "POST", {
        userId: "user-rec-2",
        canonicalGameId,
        status,
        ownership: {
          platform,
          platformGameId,
          source: "manual-import",
          ownershipType: "Digital",
        },
      }),
    );

    assert.equal(response.status, 201);
  }

  const scenarioCalls = [
    getPlayTonightRecommendations(
      new Request("http://localhost/api/recommendations/play-tonight?userId=user-rec-2"),
    ),
    getFranchiseRecommendations(
      new Request(
        "http://localhost/api/recommendations/franchise?userId=user-rec-2&franchise=fr-persona",
      ),
    ),
    getBacklogRecommendations(
      new Request("http://localhost/api/recommendations/backlog?userId=user-rec-2"),
    ),
    getShortSessionRecommendations(
      new Request("http://localhost/api/recommendations/short-session?userId=user-rec-2"),
    ),
    getLongSessionRecommendations(
      new Request("http://localhost/api/recommendations/long-session?userId=user-rec-2"),
    ),
  ];

  for (const response of await Promise.all(scenarioCalls)) {
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      primaryRecommendation: { recommendationId: string } | null;
      alternatives: Array<{ recommendationId: string }>;
      request: { type: string };
      totalCandidates: number;
    };

    assert.ok(payload.request.type.length > 0);
    assert.ok(payload.totalCandidates >= 0);
    assert.ok(payload.alternatives.length >= 0);

    if (payload.primaryRecommendation) {
      assert.ok(payload.primaryRecommendation.recommendationId.startsWith("recommendation-"));
    }
  }

  const queryResponse = await postRecommendationQuery(
    jsonRequest("http://localhost/api/recommendations/query", "POST", {
      userId: "user-rec-2",
      type: "custom",
      targetSessionMinutes: 45,
      filters: {
        genre: "rpg",
        maxEstimatedHours: 80,
      },
      pagination: {
        page: 1,
        pageSize: 2,
      },
    }),
  );

  assert.equal(queryResponse.status, 200);
  const queryPayload = (await queryResponse.json()) as {
    request: { targetSessionMinutes: number; pagination: { pageSize: number } };
    alternatives: Array<{ score: number }>;
  };

  assert.equal(queryPayload.request.targetSessionMinutes, 45);
  assert.equal(queryPayload.request.pagination.pageSize, 2);
  assert.ok(queryPayload.alternatives.length <= 1);

  const invalidResponse = await getRecommendations(
    new Request("http://localhost/api/recommendations?userId=user-rec-2&type=invalid"),
  );
  assert.equal(invalidResponse.status, 400);
});
