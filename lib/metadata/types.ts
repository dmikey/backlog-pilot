import type {
  ExternalGameIds,
  Franchise,
  Game,
  GameMetadata,
  PlatformId,
  Series,
} from "@/lib/domain/types";

export interface MetadataProviderSearchInput {
  title: string;
  aliases?: string[];
  externalIds?: ExternalGameIds;
  platformHints?: PlatformId[];
}

export interface IgdbImage {
  url: string;
  alt?: string;
}

export interface IgdbEntityRef {
  id: string;
  name: string;
}

export interface IgdbPlatformRef {
  id: number;
  name: string;
}

export interface IgdbGameRecord {
  id: number;
  title: string;
  summary?: string;
  aliases: string[];
  franchise?: IgdbEntityRef;
  series?: IgdbEntityRef;
  genres: string[];
  themes: string[];
  keywords: string[];
  releaseDate?: string;
  developers: string[];
  publishers: string[];
  coverArt?: IgdbImage;
  screenshots: IgdbImage[];
  externalIds: ExternalGameIds;
  platforms: IgdbPlatformRef[];
  editionLabel?: string;
}

export interface MetadataProvider {
  searchByTitle(title: string): Promise<IgdbGameRecord[]>;
  searchByAlias(alias: string): Promise<IgdbGameRecord[]>;
  searchByExternalIds(externalIds: ExternalGameIds): Promise<IgdbGameRecord[]>;
  getGameDetails(gameId: number): Promise<IgdbGameRecord | undefined>;
  getFranchise(franchiseId: string): Promise<IgdbEntityRef | undefined>;
  getPlatformMappings(gameId: number): Promise<IgdbPlatformRef[]>;
}

export interface CanonicalEnrichmentInput {
  id?: string;
  title: string;
  aliases?: string[];
  franchise?: string;
  releaseDate?: string;
  externalIds?: ExternalGameIds;
  platformHints?: PlatformId[];
}

export interface MatchCandidate {
  title: string;
  aliases: string[];
  franchise?: string;
  releaseDate?: string;
}

export interface CanonicalMatchResult {
  game: IgdbGameRecord;
  strategy: "exact_title" | "alias" | "franchise_similarity" | "release_date";
}

export interface EnrichedCanonicalGame {
  game: Game;
  metadata: GameMetadata;
  franchise?: Franchise;
  series?: Series;
  platformMappings: PlatformId[];
  providerGameId: number;
  matchedBy: CanonicalMatchResult["strategy"];
  refreshedAt: string;
  fromCache: boolean;
}

export interface MetadataCacheRecord {
  refreshedAt: number;
  result: EnrichedCanonicalGame;
}

export interface MetadataStore {
  upsert(enriched: EnrichedCanonicalGame): void;
  getGame(gameId: string): EnrichedCanonicalGame | undefined;
  listGames(): EnrichedCanonicalGame[];
}
