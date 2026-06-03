import assert from "node:assert/strict";
import test from "node:test";

import { GET as getPlayTonight } from "@/app/api/play-tonight/route";
import { GET as getPlayTonightAlternatives } from "@/app/api/play-tonight/alternatives/route";
import { POST as postPlayTonightFeedback } from "@/app/api/play-tonight/feedback/route";
import { GET as getPlayTonightSessionOptions } from "@/app/api/play-tonight/session-options/route";
import { POST as postLibraryGame } from "@/app/api/library/games/route";
import { resetUserLibraryServiceForTests } from "@/lib/library/container";
import { resetPlayTonightServiceForTests } from "@/lib/play-tonight/container";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("play tonight API returns primary recommendation, alternatives, session options, and feedback analytics", async () => {
  resetUserLibraryServiceForTests();
  resetPlayTonightServiceForTests();

  await postLibraryGame(
    jsonRequest("http://localhost/api/library/games", "POST", {
      userId: "user-1",
      canonicalGameId: "game-yakuza-0",
      status: "Unplayed",
      ownership: {
        platform: "steam",
        platformGameId: "638970",
        source: "steam-import",
        ownershipType: "Digital",
      },
    }),
  );

  await postLibraryGame(
    jsonRequest("http://localhost/api/library/games", "POST", {
      userId: "user-1",
      canonicalGameId: "game-yakuza-kiwami",
      status: "Unplayed",
      ownership: {
        platform: "steam",
        platformGameId: "kiwami",
        source: "steam-import",
        ownershipType: "Digital",
      },
    }),
  );

  const response = await getPlayTonight(
    new Request("http://localhost/api/play-tonight?userId=user-1&session=1-hour&platform=steam"),
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    primaryRecommendation: { recommendationId: string; recommendationScore: number; explanation: { whyNow: string[] } };
    alternatives: Array<{ recommendationId: string }>;
    sessionOption: { id: string };
    analytics: { impressions: number };
  };

  assert.equal(payload.sessionOption.id, "1-hour");
  assert.ok(payload.primaryRecommendation.recommendationScore >= 0);
  assert.ok(payload.primaryRecommendation.explanation.whyNow.length > 0);
  assert.ok(payload.alternatives.length <= 3);
  assert.equal(payload.analytics.impressions, 1);

  const alternativesResponse = await getPlayTonightAlternatives(
    new Request("http://localhost/api/play-tonight/alternatives?userId=user-1&session=1-hour"),
  );
  assert.equal(alternativesResponse.status, 200);
  const alternativesPayload = (await alternativesResponse.json()) as {
    alternatives: Array<{ recommendationId: string }>;
    explanation: { whyNotSomethingElse: string };
  };
  assert.ok(alternativesPayload.alternatives.length <= 3);
  assert.ok(alternativesPayload.explanation.whyNotSomethingElse.length > 0);

  const sessionOptionsResponse = await getPlayTonightSessionOptions();
  assert.equal(sessionOptionsResponse.status, 200);
  const sessionOptionsPayload = (await sessionOptionsResponse.json()) as {
    options: Array<{ id: string }>;
    defaultOption: { id: string };
  };
  assert.equal(sessionOptionsPayload.defaultOption.id, "1-hour");
  assert.equal(sessionOptionsPayload.options.length, 5);

  const feedbackResponse = await postPlayTonightFeedback(
    jsonRequest("http://localhost/api/play-tonight/feedback", "POST", {
      userId: "user-1",
      recommendationId: payload.primaryRecommendation.recommendationId,
      action: "play_this",
      sessionOptionId: "1-hour",
      platform: "steam",
    }),
  );
  assert.equal(feedbackResponse.status, 201);
  const feedbackPayload = (await feedbackResponse.json()) as {
    accepted: boolean;
    analytics: { acceptance: number };
  };
  assert.equal(feedbackPayload.accepted, true);
  assert.equal(feedbackPayload.analytics.acceptance, 1);
});

test("play tonight API validates required userId and feedback action", async () => {
  resetUserLibraryServiceForTests();
  resetPlayTonightServiceForTests();

  const missingUserResponse = await getPlayTonight(new Request("http://localhost/api/play-tonight"));
  assert.equal(missingUserResponse.status, 400);

  const invalidFeedbackResponse = await postPlayTonightFeedback(
    jsonRequest("http://localhost/api/play-tonight/feedback", "POST", {
      userId: "user-1",
      recommendationId: "rec-1",
      action: "bad-action",
    }),
  );
  assert.equal(invalidFeedbackResponse.status, 400);
});
