import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryLibraryRepository } from "@/lib/library/repository";
import { UserLibraryService } from "@/lib/library/service";
import { PlayTonightService } from "@/lib/play-tonight/service";

function seedLibrary(service: UserLibraryService, userId: string) {
  service.createLibrary(userId);

  service.addGame({
    userId,
    canonicalGameId: "game-yakuza-0",
    status: "Unplayed",
    ownership: {
      platform: "steam",
      platformGameId: "638970",
      source: "steam-import",
      ownershipType: "Digital",
      acquiredAt: "2024-01-01",
    },
  });

  service.addGame({
    userId,
    canonicalGameId: "game-yakuza-kiwami",
    status: "Unplayed",
    ownership: {
      platform: "steam",
      platformGameId: "kiwami",
      source: "steam-import",
      ownershipType: "Digital",
      acquiredAt: "2023-05-05",
    },
  });

  service.addGame({
    userId,
    canonicalGameId: "game-monster-hunter-rise",
    status: "Active",
    ownership: {
      platform: "nintendo-switch",
      platformGameId: "0100559011740000",
      source: "switch-import",
      ownershipType: "Digital",
      acquiredAt: "2022-06-01",
    },
  });

  service.addGame({
    userId,
    canonicalGameId: "game-final-fantasy-tactics-wotl",
    status: "Unplayed",
    ownership: {
      platform: "psp",
      platformGameId: "ULUS10297",
      source: "manual-import",
      ownershipType: "Physical",
      acquiredAt: "2012-01-01",
    },
  });
}

test("PlayTonightService ranks recommendations, supports session/platform filtering, and limits options", () => {
  const libraryService = new UserLibraryService(createInMemoryLibraryRepository());
  seedLibrary(libraryService, "user-1");

  const service = new PlayTonightService(libraryService);
  const fifteenMinute = service.getExperience({
    userId: "user-1",
    sessionOptionId: "15-minutes",
    platform: "steam",
  });

  assert.equal(fifteenMinute.sessionOption.id, "15-minutes");
  assert.equal(fifteenMinute.selectedPlatform, "steam");
  assert.ok(fifteenMinute.primaryRecommendation.recommendationScore >= 0);
  assert.ok(fifteenMinute.primaryRecommendation.recommendationScore <= 100);
  assert.ok(fifteenMinute.primaryRecommendation.estimatedCompletionHours <= 35);
  assert.ok(
    [
      fifteenMinute.primaryRecommendation,
      ...fifteenMinute.alternatives,
    ].every((entry) => entry.platform === "steam"),
  );
  assert.ok(fifteenMinute.decisionFatigueGuard.shownRecommendations <= 4);
});

test("PlayTonightService generates explanation output for why this game, why now, and why not alternatives", () => {
  const libraryService = new UserLibraryService(createInMemoryLibraryRepository());
  seedLibrary(libraryService, "user-2");

  const service = new PlayTonightService(libraryService);
  const experience = service.getExperience({ userId: "user-2", sessionOptionId: "1-hour" });

  assert.ok(experience.primaryRecommendation.explanation.whyThisGame.length > 0);
  assert.ok(experience.primaryRecommendation.explanation.whyNow.length > 0);
  assert.ok(experience.primaryRecommendation.explanation.whyNotSomethingElse.length > 0);
  assert.equal(experience.primaryRecommendation.explanation.useCase, "play-tonight");
  assert.ok(experience.primaryRecommendation.explanation.structuredReasons.length >= 3);
});
