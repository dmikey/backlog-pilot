import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryIGDBProvider, demoIgdbRecords } from "@/lib/metadata/igdb-provider";
import {
  InMemoryMetadataStore,
  MetadataEnrichmentService,
  MetadataRefreshService,
} from "@/lib/metadata/service";

class CountingProvider extends InMemoryIGDBProvider {
  callCounts = {
    searchByTitle: 0,
    searchByAlias: 0,
    searchByExternalIds: 0,
    getGameDetails: 0,
    getPlatformMappings: 0,
  };

  override async searchByTitle(title: string) {
    this.callCounts.searchByTitle += 1;
    return super.searchByTitle(title);
  }

  override async searchByAlias(alias: string) {
    this.callCounts.searchByAlias += 1;
    return super.searchByAlias(alias);
  }

  override async searchByExternalIds(externalIds: Parameters<InMemoryIGDBProvider["searchByExternalIds"]>[0]) {
    this.callCounts.searchByExternalIds += 1;
    return super.searchByExternalIds(externalIds);
  }

  override async getGameDetails(gameId: number) {
    this.callCounts.getGameDetails += 1;
    return super.getGameDetails(gameId);
  }

  override async getPlatformMappings(gameId: number) {
    this.callCounts.getPlatformMappings += 1;
    return super.getPlatformMappings(gameId);
  }
}

test("enrichGame imports canonical metadata including franchise, media, and platform mappings", async () => {
  const provider = new CountingProvider(demoIgdbRecords);
  const service = new MetadataEnrichmentService(provider, {
    store: new InMemoryMetadataStore(),
    cacheTtlMs: 60_000,
  });

  const enriched = await service.enrichGame({
    id: "game-persona-4-golden",
    title: "Persona 4 Golden",
    aliases: ["P4G"],
    franchise: "Persona",
    releaseDate: "2012-06-14",
    externalIds: { steamAppId: 1113000 },
  });

  assert.equal(enriched.game.id, "game-persona-4-golden");
  assert.equal(enriched.game.canonicalTitle, "Persona 4 Golden");
  assert.equal(enriched.metadata.externalIds.igdbId, 4573);
  assert.equal(enriched.franchise?.name, "Persona");
  assert.equal(enriched.series?.name, "Persona Mainline");
  assert.ok(enriched.game.coverArt.url.startsWith("https://"));
  assert.ok(enriched.game.screenshots.length > 0);
  assert.deepEqual(enriched.platformMappings.sort(), ["psvita", "steam"]);
  assert.equal(enriched.fromCache, false);
});

test("enrichGame caches provider calls and forceRefresh bypasses cache", async () => {
  const provider = new CountingProvider(demoIgdbRecords);
  const service = new MetadataEnrichmentService(provider, {
    store: new InMemoryMetadataStore(),
    cacheTtlMs: 60_000,
  });

  await service.enrichGame({
    id: "game-yakuza-0",
    title: "Yakuza 0",
    aliases: ["Ryū ga Gotoku 0"],
    franchise: "Like a Dragon",
    releaseDate: "2015-03-12",
    externalIds: { steamAppId: 638970 },
  });

  const afterFirst = { ...provider.callCounts };

  const second = await service.enrichGame({
    id: "game-yakuza-0",
    title: "Yakuza 0",
    aliases: ["Ryū ga Gotoku 0"],
    franchise: "Like a Dragon",
    releaseDate: "2015-03-12",
    externalIds: { steamAppId: 638970 },
  });

  assert.equal(second.fromCache, true);
  assert.deepEqual(provider.callCounts, afterFirst);

  await service.enrichGame(
    {
      id: "game-yakuza-0",
      title: "Yakuza 0",
      aliases: ["Ryū ga Gotoku 0"],
      franchise: "Like a Dragon",
      releaseDate: "2015-03-12",
      externalIds: { steamAppId: 638970 },
    },
    { forceRefresh: true },
  );

  assert.ok(provider.callCounts.searchByTitle > afterFirst.searchByTitle);
  assert.ok(provider.callCounts.getGameDetails > afterFirst.getGameDetails);
});

test("bulkEnrich and refresh workflows keep canonical records refreshable", async () => {
  const provider = new CountingProvider(demoIgdbRecords);
  const store = new InMemoryMetadataStore();
  const enrichmentService = new MetadataEnrichmentService(provider, {
    store,
    cacheTtlMs: 60_000,
  });
  const refreshService = new MetadataRefreshService(enrichmentService);

  const bulk = await refreshService.bulkEnrich([
    {
      id: "game-persona-4-golden",
      title: "Persona 4 Golden",
      aliases: ["P4G"],
      franchise: "Persona",
      releaseDate: "2012-06-14",
      externalIds: { steamAppId: 1113000 },
    },
    {
      id: "game-monster-hunter-rise",
      title: "Monster Hunter Rise",
      aliases: ["MHR"],
      franchise: "Monster Hunter",
      releaseDate: "2021-03-26",
      externalIds: { steamAppId: 1446780 },
    },
  ]);

  assert.equal(bulk.length, 2);
  assert.ok(store.getGame("game-persona-4-golden"));

  const refreshedSingle = await refreshService.refreshGame("game-persona-4-golden");
  assert.equal(refreshedSingle.game.id, "game-persona-4-golden");
  assert.equal(refreshedSingle.fromCache, false);

  const refreshedAll = await refreshService.refreshAll();
  assert.equal(refreshedAll.length, 2);
});
