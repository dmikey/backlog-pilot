import type {
  Game,
  GameEdition,
  GameMetadata,
  Genre,
  ImageAsset,
  PlatformId,
  Tag,
} from "@/lib/domain/types";
import {
  InMemoryIGDBProvider,
  mapIgdbPlatformsToSupportedPlatforms,
} from "@/lib/metadata/igdb-provider";
import { normalizeForMatch, resolveCanonicalMatch } from "@/lib/metadata/matching";
import type {
  CanonicalEnrichmentInput,
  EnrichedCanonicalGame,
  IgdbGameRecord,
  MetadataCacheRecord,
  MetadataProvider,
  MetadataStore,
} from "@/lib/metadata/types";

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const DEFAULT_RELEASE_DATE = "1970-01-01";

export class MetadataEnrichmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetadataEnrichmentError";
  }
}

interface MetadataEnrichmentServiceOptions {
  cacheTtlMs?: number;
  store?: MetadataStore;
}

interface EnrichOptions {
  forceRefresh?: boolean;
}

export class MetadataEnrichmentService {
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, MetadataCacheRecord>();
  private readonly store: MetadataStore;

  constructor(
    private readonly provider: MetadataProvider,
    options: MetadataEnrichmentServiceOptions = {},
  ) {
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.store = options.store ?? new InMemoryMetadataStore();
  }

  async enrichGame(input: CanonicalEnrichmentInput, options: EnrichOptions = {}): Promise<EnrichedCanonicalGame> {
    const cacheKey = getCacheKey(input);
    const cached = this.cache.get(cacheKey);

    if (!options.forceRefresh && cached && !this.isStale(cached.refreshedAt)) {
      return {
        ...cached.result,
        fromCache: true,
      };
    }

    const candidates = await this.getCandidates(input);
    const match = resolveCanonicalMatch(
      {
        title: input.title,
        aliases: input.aliases ?? [],
        franchise: input.franchise,
        releaseDate: input.releaseDate,
      },
      candidates,
    );

    if (!match) {
      throw new MetadataEnrichmentError(`No IGDB match found for canonical title: ${input.title}`);
    }

    const details = await this.provider.getGameDetails(match.game.id);
    if (!details) {
      throw new MetadataEnrichmentError(`IGDB details missing for game id: ${match.game.id}`);
    }

    const platformMappings = mapIgdbPlatformsToSupportedPlatforms(
      await this.provider.getPlatformMappings(details.id),
    );

    const refreshedAt = new Date().toISOString();
    const normalized = normalizeEnrichedRecord(input, details, platformMappings, match.strategy, refreshedAt);

    this.store.upsert(normalized);
    this.cache.set(cacheKey, {
      refreshedAt: Date.now(),
      result: normalized,
    });

    return normalized;
  }

  async bulkEnrich(
    inputs: CanonicalEnrichmentInput[],
    options: EnrichOptions = {},
  ): Promise<EnrichedCanonicalGame[]> {
    const enriched: EnrichedCanonicalGame[] = [];

    for (const input of inputs) {
      enriched.push(await this.enrichGame(input, options));
    }

    return enriched;
  }

  async refreshGame(gameId: string): Promise<EnrichedCanonicalGame> {
    const existing = this.store.getGame(gameId);

    if (!existing) {
      throw new MetadataEnrichmentError(`Cannot refresh missing canonical game: ${gameId}`);
    }

    return this.enrichGame(
      {
        id: existing.game.id,
        title: existing.game.canonicalTitle,
        aliases: existing.game.aliases,
        franchise: existing.franchise?.name,
        releaseDate: existing.game.releaseDate,
        externalIds: existing.metadata.externalIds,
        platformHints: existing.platformMappings,
      },
      { forceRefresh: true },
    );
  }

  async refreshAll(): Promise<EnrichedCanonicalGame[]> {
    const games = this.store.listGames();
    const refreshed: EnrichedCanonicalGame[] = [];

    for (const game of games) {
      refreshed.push(await this.refreshGame(game.game.id));
    }

    return refreshed;
  }

  getStore(): MetadataStore {
    return this.store;
  }

  private isStale(refreshedAt: number): boolean {
    return Date.now() - refreshedAt > this.cacheTtlMs;
  }

  private async getCandidates(input: CanonicalEnrichmentInput) {
    const byTitle = await this.provider.searchByTitle(input.title);
    const byAlias = await Promise.all((input.aliases ?? []).map((alias) => this.provider.searchByAlias(alias)));
    const byExternalIds = input.externalIds
      ? await this.provider.searchByExternalIds(input.externalIds)
      : [];

    const combined = [...byExternalIds, ...byTitle, ...byAlias.flat()];
    const deduplicated = new Map<number, (typeof combined)[number]>();

    for (const record of combined) {
      deduplicated.set(record.id, record);
    }

    return [...deduplicated.values()];
  }
}

export class MetadataRefreshService {
  constructor(private readonly enrichmentService: MetadataEnrichmentService) {}

  refreshGame(gameId: string) {
    return this.enrichmentService.refreshGame(gameId);
  }

  refreshAll() {
    return this.enrichmentService.refreshAll();
  }

  bulkEnrich(inputs: CanonicalEnrichmentInput[], options: EnrichOptions = {}) {
    return this.enrichmentService.bulkEnrich(inputs, options);
  }
}

export class InMemoryMetadataStore implements MetadataStore {
  private readonly records = new Map<string, EnrichedCanonicalGame>();

  upsert(enriched: EnrichedCanonicalGame): void {
    this.records.set(enriched.game.id, enriched);
  }

  getGame(gameId: string): EnrichedCanonicalGame | undefined {
    return this.records.get(gameId);
  }

  listGames(): EnrichedCanonicalGame[] {
    return [...this.records.values()];
  }
}

function getCacheKey(input: CanonicalEnrichmentInput): string {
  const aliasKey = (input.aliases ?? []).map(normalizeForMatch).sort().join("|");
  const externalIdKey = input.externalIds
    ? [
        input.externalIds.igdbId,
        input.externalIds.steamAppId,
        input.externalIds.nintendoTitleId,
        input.externalIds.giantBombId,
        input.externalIds.metacriticSlug,
      ]
        .filter((value) => value !== undefined)
        .join("|")
    : "";

  return [input.id ?? "", normalizeForMatch(input.title), aliasKey, externalIdKey].join("::");
}

function normalizeEnrichedRecord(
  input: CanonicalEnrichmentInput,
  gameDetails: IgdbGameRecord,
  platformMappings: PlatformId[],
  matchedBy: EnrichedCanonicalGame["matchedBy"],
  refreshedAt: string,
): EnrichedCanonicalGame {
  const gameId = input.id ?? `game-${normalizeForMatch(gameDetails.title)}`;
  const franchise = gameDetails.franchise
    ? {
        id: `fr-${normalizeForMatch(gameDetails.franchise.name)}`,
        name: gameDetails.franchise.name,
        normalizedName: normalizeForMatch(gameDetails.franchise.name),
      }
    : undefined;

  const series = gameDetails.series
    ? {
        id: `series-${normalizeForMatch(gameDetails.series.name)}`,
        franchiseId: franchise?.id ?? `fr-${normalizeForMatch(gameDetails.series.name)}`,
        name: gameDetails.series.name,
        normalizedName: normalizeForMatch(gameDetails.series.name),
      }
    : undefined;

  const aliases = uniqueStrings([...new Set([...(input.aliases ?? []), ...gameDetails.aliases])]);

  const game: Game = {
    id: gameId,
    canonicalTitle: gameDetails.title,
    normalizedTitle: normalizeForMatch(gameDetails.title),
    aliases,
    normalizedAliases: aliases.map(normalizeForMatch),
    franchiseId: franchise?.id,
    seriesId: series?.id,
    description: gameDetails.summary ?? `${gameDetails.title} metadata imported from IGDB.`,
    releaseDate: gameDetails.releaseDate ?? input.releaseDate ?? DEFAULT_RELEASE_DATE,
    developer: uniqueStrings(gameDetails.developers),
    publisher: uniqueStrings(gameDetails.publishers),
    genres: toGenres(gameDetails.genres),
    tags: toTags([...gameDetails.themes, ...gameDetails.keywords]),
    coverArt: toCoverArt(gameDetails.coverArt, gameDetails.title),
    screenshots: toScreenshots(gameDetails.screenshots, gameDetails.title),
    edition: toEdition(gameDetails.editionLabel, gameDetails.title),
  };

  const metadata: GameMetadata = {
    gameId,
    externalIds: {
      ...gameDetails.externalIds,
      ...(input.externalIds ?? {}),
      igdbId: gameDetails.id,
    },
    aliasMatchKeys: aliases.map((alias) => normalizeForMatch(alias).replace(/-/g, "")),
    editionMatchKeys: [game.edition.kind, game.edition.label, game.edition.canonicalEditionKey],
    duplicateDetectionKey: `${game.normalizedTitle}-${game.edition.kind}`,
    completionTimeHours: { main: 0 },
    genreWeights: game.genres.reduce((weights, genre) => {
      weights[genre.id] = 1;
      return weights;
    }, {} as NonNullable<GameMetadata["genreWeights"]>),
    franchiseCompletionWeight: franchise ? 1 : undefined,
    estimatedHours: 0,
    completionLikelihood: "medium",
    mood: `IGDB-enriched metadata for ${game.canonicalTitle}`,
  };

  return {
    game,
    metadata,
    franchise,
    series,
    platformMappings,
    providerGameId: gameDetails.id,
    matchedBy,
    refreshedAt,
    fromCache: false,
  };
}

function uniqueStrings(values: string[]): string[] {
  const unique = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    unique.add(trimmed);
  }

  return [...unique];
}

function toGenres(values: string[]): Genre[] {
  return uniqueStrings(values).map((name) => ({
    id: `genre-${normalizeForMatch(name)}`,
    name,
  }));
}

function toTags(values: string[]): Tag[] {
  return uniqueStrings(values).map((name) => ({
    id: `tag-${normalizeForMatch(name)}`,
    name,
  }));
}

function toCoverArt(cover: { url: string; alt?: string } | undefined, gameTitle: string): ImageAsset {
  return {
    url: cover?.url ?? "https://images.igdb.com/igdb/image/upload/t_cover_big/default.jpg",
    alt: cover?.alt ?? `${gameTitle} cover art`,
  };
}

function toScreenshots(screenshots: Array<{ url: string; alt?: string }>, gameTitle: string): ImageAsset[] {
  if (screenshots.length === 0) {
    return [
      {
        url: "https://images.igdb.com/igdb/image/upload/t_screenshot_big/default.jpg",
        alt: `${gameTitle} screenshot`,
      },
    ];
  }

  return screenshots.map((screenshot, index) => ({
    url: screenshot.url,
    alt: screenshot.alt ?? `${gameTitle} screenshot ${index + 1}`,
  }));
}

function toEdition(label: string | undefined, gameTitle: string): GameEdition {
  const normalizedLabel = normalizeForMatch(label ?? "standard");

  let kind: GameEdition["kind"] = "standard";

  if (normalizedLabel.includes("gold") || normalizedLabel.includes("definitive")) {
    kind = "definitive";
  } else if (normalizedLabel.includes("collection")) {
    kind = "collection";
  } else if (normalizedLabel.includes("remaster")) {
    kind = "remaster";
  } else if (normalizedLabel.includes("port") || normalizedLabel.includes("base")) {
    kind = "port";
  }

  const editionLabel = label?.trim() || "Standard";

  return {
    kind,
    label: editionLabel,
    canonicalEditionKey: `${normalizeForMatch(gameTitle)}-${normalizeForMatch(editionLabel)}`,
  };
}

export function createDefaultMetadataEnrichmentService(provider: MetadataProvider = new InMemoryIGDBProvider()) {
  return new MetadataEnrichmentService(provider);
}
