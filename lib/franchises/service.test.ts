import assert from "node:assert/strict";
import test from "node:test";

import type { Franchise, Game, GameMetadata, Series } from "@/lib/domain/types";
import { DuplicateOwnershipService } from "@/lib/duplicates/duplicate-ownership-service";
import { FranchiseProgressService } from "@/lib/franchises/franchise-progress-service";
import { FranchiseRecommendationSignals } from "@/lib/franchises/recommendation-signals";
import { SeriesProgressService } from "@/lib/franchises/series-progress-service";
import { FranchiseTrackingService } from "@/lib/franchises/tracking-service";
import type { FranchiseCatalog } from "@/lib/franchises/types";
import { InMemoryIGDBProvider } from "@/lib/metadata/igdb-provider";
import { MetadataEnrichmentService } from "@/lib/metadata/service";
import { createInMemoryLibraryRepository } from "@/lib/library/repository";
import { UserLibraryService } from "@/lib/library/service";

function createGame(
  id: string,
  title: string,
  releaseDate: string,
  franchiseId: string,
  seriesId: string,
): Game {
  return {
    id,
    canonicalTitle: title,
    normalizedTitle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    aliases: [],
    normalizedAliases: [],
    franchiseId,
    seriesId,
    description: `${title} description`,
    releaseDate,
    developer: ["Test Studio"],
    publisher: ["Test Publisher"],
    genres: [{ id: "genre-rpg", name: "RPG" }],
    tags: [{ id: "tag-test", name: "Test" }],
    coverArt: { url: "https://example.com/cover.jpg", alt: `${title} cover` },
    screenshots: [],
    edition: {
      kind: "standard",
      label: "Standard",
      canonicalEditionKey: `${id}-standard`,
    },
  };
}

function createMetadata(gameId: string, franchiseCompletionWeight: number): GameMetadata {
  return {
    gameId,
    externalIds: {},
    aliasMatchKeys: [],
    editionMatchKeys: [],
    duplicateDetectionKey: gameId,
    completionTimeHours: { main: 20 },
    estimatedHours: 20,
    completionLikelihood: "medium",
    mood: "Test mood",
    franchiseCompletionWeight,
  };
}

function createCatalog(): FranchiseCatalog {
  const franchises: Franchise[] = [
    { id: "fr-persona", name: "Persona", normalizedName: "persona" },
    { id: "fr-yakuza", name: "Yakuza", normalizedName: "yakuza" },
  ];
  const series: Series[] = [
    {
      id: "series-persona-mainline",
      franchiseId: "fr-persona",
      name: "Persona Mainline",
      normalizedName: "persona-mainline",
    },
    {
      id: "series-persona-spinoffs",
      franchiseId: "fr-persona",
      name: "Persona Spinoffs",
      normalizedName: "persona-spinoffs",
    },
    {
      id: "series-yakuza-mainline",
      franchiseId: "fr-yakuza",
      name: "Yakuza Mainline",
      normalizedName: "yakuza-mainline",
    },
  ];
  const games = [
    createGame("game-persona-3-portable", "Persona 3 Portable", "2009-11-01", "fr-persona", "series-persona-mainline"),
    createGame("game-persona-4-golden", "Persona 4 Golden", "2012-06-14", "fr-persona", "series-persona-mainline"),
    createGame("game-persona-4-arena", "Persona 4 Arena", "2012-07-26", "fr-persona", "series-persona-spinoffs"),
    createGame("game-persona-5-royal", "Persona 5 Royal", "2019-10-31", "fr-persona", "series-persona-mainline"),
    createGame("game-yakuza-0", "Yakuza 0", "2015-03-12", "fr-yakuza", "series-yakuza-mainline"),
    createGame("game-yakuza-kiwami", "Yakuza Kiwami", "2016-01-21", "fr-yakuza", "series-yakuza-mainline"),
  ];

  return {
    games,
    metadata: games.map((game, index) => createMetadata(game.id, 0.7 + index * 0.03)),
    franchises,
    series,
  };
}

function createService(catalog = createCatalog()) {
  const gamesById = new Map(catalog.games.map((game) => [game.id, game]));
  const metadataById = new Map(catalog.metadata.map((metadata) => [metadata.gameId, metadata]));
  const libraryService = new UserLibraryService(createInMemoryLibraryRepository(), {
    getGameById(gameId) {
      return gamesById.get(gameId);
    },
    getMetadataByGameId(gameId) {
      return metadataById.get(gameId);
    },
  });

  return {
    catalog,
    libraryService,
    trackingService: new FranchiseTrackingService(catalog),
  };
}

test("FranchiseTrackingService groups owned games by franchise", () => {
  const { libraryService, trackingService } = createService();

  libraryService.addGame({
    userId: "user-1",
    canonicalGameId: "game-persona-3-portable",
    status: "Completed",
    ownership: {
      platform: "psp",
      platformGameId: "P3P",
      source: "manual-import",
      ownershipType: "Physical",
    },
  });
  libraryService.addGame({
    userId: "user-1",
    canonicalGameId: "game-persona-5-royal",
    status: "Unplayed",
    ownership: {
      platform: "steam",
      platformGameId: "P5R",
      source: "manual-import",
      ownershipType: "Digital",
    },
  });
  libraryService.addGame({
    userId: "user-1",
    canonicalGameId: "game-yakuza-0",
    status: "Active",
    ownership: {
      platform: "steam",
      platformGameId: "Y0",
      source: "manual-import",
      ownershipType: "Digital",
    },
  });

  const groups = trackingService.groupByFranchise(libraryService.listGames("user-1"));
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.franchise.name, "Persona");
  assert.equal(groups[0]?.libraryGames.length, 2);
  assert.equal(groups[1]?.franchise.name, "Yakuza");
});

test("SeriesProgressService groups mainline and spinoff entries separately", () => {
  const { libraryService, trackingService } = createService();
  const service = new SeriesProgressService(trackingService);

  for (const [gameId, status] of [
    ["game-persona-3-portable", "Completed"],
    ["game-persona-4-arena", "Active"],
    ["game-persona-5-royal", "Unplayed"],
  ] as const) {
    libraryService.addGame({
      userId: "user-1",
      canonicalGameId: gameId,
      status,
      ownership: {
        platform: "steam",
        platformGameId: gameId,
        source: "manual-import",
        ownershipType: "Digital",
      },
    });
  }

  const progress = service.listForUser("user-1", libraryService.listGames("user-1"));
  assert.equal(progress.length, 2);
  assert.equal(progress[0]?.seriesName, "Persona Mainline");
  assert.equal(progress[0]?.totalOwned, 2);
  assert.equal(progress[1]?.seriesName, "Persona Spinoffs");
  assert.equal(progress[1]?.totalActive, 1);
});

test("FranchiseProgressService calculates completion metrics, near completion, and campaigns", () => {
  const { libraryService, trackingService } = createService();
  const service = new FranchiseProgressService(libraryService, trackingService);

  for (const [gameId, status] of [
    ["game-persona-3-portable", "Completed"],
    ["game-persona-4-golden", "Completed"],
    ["game-persona-5-royal", "Unplayed"],
    ["game-yakuza-0", "Abandoned"],
  ] as const) {
    libraryService.addGame({
      userId: "user-1",
      canonicalGameId: gameId,
      status,
      ownership: {
        platform: "steam",
        platformGameId: gameId,
        source: "manual-import",
        ownershipType: "Digital",
      },
    });
  }

  const persona = service.getByFranchiseId("user-1", "fr-persona");
  assert.ok(persona);
  assert.equal(persona.totalOwned, 3);
  assert.equal(persona.totalCompleted, 2);
  assert.equal(persona.totalUnplayed, 1);
  assert.equal(persona.completionPercentage, 66.7);
  assert.equal(persona.nextRecommendedGameId, "game-persona-5-royal");

  const nearCompletion = service.getNearCompletion("user-1");
  assert.equal(nearCompletion.length, 2);
  assert.equal(nearCompletion[0]?.franchiseId, "fr-persona");

  const snapshot = service.getSnapshot("user-1");
  assert.equal(snapshot.summary.closestFranchisesToCompletion[0]?.franchiseId, "fr-persona");
  assert.match(snapshot.summary.activeFranchiseCampaigns[0]?.description ?? "", /one game away|Resume/);
});

test("FranchiseRecommendationSignals generates continuation, affinity, and penalty signals", () => {
  const { libraryService, trackingService } = createService();
  const service = new FranchiseRecommendationSignals(libraryService, trackingService);

  for (const [gameId, status] of [
    ["game-persona-3-portable", "Completed"],
    ["game-persona-4-golden", "Completed"],
    ["game-persona-5-royal", "Unplayed"],
    ["game-yakuza-0", "Abandoned"],
  ] as const) {
    libraryService.addGame({
      userId: "user-1",
      canonicalGameId: gameId,
      status,
      ownership: {
        platform: "steam",
        platformGameId: gameId,
        source: "manual-import",
        ownershipType: "Digital",
      },
    });
  }

  const persona = service.getForFranchise("user-1", "fr-persona");
  assert.ok(persona);
  assert.equal(persona.nextRecommendedGameId, "game-persona-5-royal");
  assert.ok(persona.nearFranchiseCompletionBonus > 0);
  assert.ok(persona.franchiseAffinityScore > 0.5);
  assert.ok(persona.seriesContinuationBonus > 0.5);

  const yakuza = service.getForFranchise("user-1", "fr-yakuza");
  assert.ok(yakuza);
  assert.ok(yakuza.abandonedFranchisePenalty > 0);
});

test("Franchise progress integrates with user library and duplicate ownership without double-counting canonicals", () => {
  const { libraryService, trackingService } = createService();
  const progressService = new FranchiseProgressService(libraryService, trackingService);
  const duplicateService = new DuplicateOwnershipService(libraryService);

  libraryService.addGame({
    userId: "user-1",
    canonicalGameId: "game-persona-4-golden",
    status: "Completed",
    ownership: {
      platform: "steam",
      platformGameId: "1113000",
      source: "steam-import",
      ownershipType: "Digital",
    },
  });
  libraryService.addGame({
    userId: "user-1",
    canonicalGameId: "game-persona-4-golden",
    ownership: {
      platform: "psvita",
      platformGameId: "PCSE00120",
      source: "manual-import",
      ownershipType: "Physical",
    },
  });
  libraryService.addGame({
    userId: "user-1",
    canonicalGameId: "game-persona-5-royal",
    status: "Unplayed",
    ownership: {
      platform: "steam",
      platformGameId: "P5R",
      source: "manual-import",
      ownershipType: "Digital",
    },
  });

  const persona = progressService.getByFranchiseId("user-1", "fr-persona");
  assert.ok(persona);
  assert.equal(persona.totalOwned, 2);
  assert.equal(duplicateService.getDuplicateGroups("user-1").length, 1);
});

test("Franchise tracking supports metadata-enriched franchise and series catalogs", async () => {
  const provider = new InMemoryIGDBProvider([
    {
      id: 10952,
      title: "Yakuza 0",
      aliases: ["Ryū ga Gotoku 0"],
      franchise: { id: "like-a-dragon", name: "Like a Dragon" },
      series: { id: "like-a-dragon-mainline", name: "Like a Dragon Mainline" },
      genres: ["Action"],
      themes: ["Crime"],
      keywords: ["Brawler"],
      releaseDate: "2015-03-12",
      developers: ["Ryu Ga Gotoku Studio"],
      publishers: ["Sega"],
      coverArt: { url: "https://example.com/y0.jpg", alt: "Yakuza 0 cover art" },
      screenshots: [],
      externalIds: { igdbId: 10952, steamAppId: 638970 },
      platforms: [{ id: 6, name: "PC (Microsoft Windows)" }],
      editionLabel: "Standard",
    },
    {
      id: 19418,
      title: "Yakuza Kiwami",
      aliases: ["Like a Dragon Kiwami"],
      franchise: { id: "like-a-dragon", name: "Like a Dragon" },
      series: { id: "like-a-dragon-mainline", name: "Like a Dragon Mainline" },
      genres: ["Action"],
      themes: ["Crime"],
      keywords: ["Brawler"],
      releaseDate: "2016-01-21",
      developers: ["Ryu Ga Gotoku Studio"],
      publishers: ["Sega"],
      coverArt: { url: "https://example.com/kiwami.jpg", alt: "Yakuza Kiwami cover art" },
      screenshots: [],
      externalIds: { igdbId: 19418 },
      platforms: [{ id: 6, name: "PC (Microsoft Windows)" }],
      editionLabel: "Kiwami",
    },
  ]);
  const enrichmentService = new MetadataEnrichmentService(provider);
  const enriched = await enrichmentService.bulkEnrich([
    {
      id: "game-yakuza-0",
      title: "Yakuza 0",
      aliases: ["Ryū ga Gotoku 0"],
      franchise: "Like a Dragon",
      externalIds: { steamAppId: 638970 },
    },
    {
      id: "game-yakuza-kiwami",
      title: "Yakuza Kiwami",
      aliases: ["Like a Dragon Kiwami"],
      franchise: "Like a Dragon",
      externalIds: { igdbId: 19418 },
    },
  ]);
  const trackingService = new FranchiseTrackingService({
    games: enriched.map((entry) => entry.game),
    metadata: enriched.map((entry) => entry.metadata),
    franchises: enriched.flatMap((entry) => (entry.franchise ? [entry.franchise] : [])),
    series: enriched.flatMap((entry) => (entry.series ? [entry.series] : [])),
  });

  const groups = trackingService.groupByFranchise(
    enriched.map((entry, index) => ({
      game: {
        id: `${entry.game.id}-library`,
        userId: "user-1",
        canonicalGameId: entry.game.id,
        status: index === 0 ? "Completed" : "Unplayed",
        playtimeHours: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      ownershipRecords: [],
      canonicalGame: entry.game,
      canonicalMetadata: entry.metadata,
    })),
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.franchise.name, "Like a Dragon");
  assert.equal(trackingService.getNextRecommendedGame(groups[0]?.libraryGames ?? [], groups[0]?.franchise.id ?? "")?.id, "game-yakuza-kiwami");
});
