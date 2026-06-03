import type { ExternalGameIds, PlatformId } from "@/lib/domain/types";
import { normalizeForMatch } from "@/lib/metadata/matching";
import type {
  IgdbEntityRef,
  IgdbGameRecord,
  IgdbPlatformRef,
  MetadataProvider,
} from "@/lib/metadata/types";

const supportedPlatformMap: Record<number, PlatformId> = {
  6: "steam",
  130: "nintendo-switch",
  24: "gba",
  38: "psp",
  46: "psvita",
};

interface IgdbHttpConfig {
  baseUrl?: string;
  clientId: string;
  accessToken: string;
}

export class IGDBProvider implements MetadataProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly config: IgdbHttpConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = config.baseUrl ?? "https://api.igdb.com/v4";
  }

  async searchByTitle(title: string): Promise<IgdbGameRecord[]> {
    return this.queryGames(`search "${escapeQueryValue(title)}"; fields ${gameFieldSelection}; limit 20;`);
  }

  async searchByAlias(alias: string): Promise<IgdbGameRecord[]> {
    const query = [
      `fields ${gameFieldSelection};`,
      `where alternative_names.name ~ *"${escapeQueryValue(alias)}"*;`,
      "limit 20;",
    ].join(" ");

    return this.queryGames(query);
  }

  async searchByExternalIds(externalIds: ExternalGameIds): Promise<IgdbGameRecord[]> {
    const clauses: string[] = [];

    if (externalIds.steamAppId) {
      clauses.push(`external_games.uid = "${externalIds.steamAppId}"`);
    }

    if (externalIds.igdbId) {
      clauses.push(`id = ${externalIds.igdbId}`);
    }

    if (clauses.length === 0) {
      return [];
    }

    const query = `fields ${gameFieldSelection}; where ${clauses.join(" | ")}; limit 10;`;
    return this.queryGames(query);
  }

  async getGameDetails(gameId: number): Promise<IgdbGameRecord | undefined> {
    const games = await this.queryGames(`fields ${gameFieldSelection}; where id = ${gameId}; limit 1;`);
    return games[0];
  }

  async getFranchise(franchiseId: string): Promise<IgdbEntityRef | undefined> {
    const [franchise] = await this.query<IgdbApiNamedEntity>(
      "franchises",
      `fields id,name; where id = ${Number.parseInt(franchiseId, 10)}; limit 1;`,
    );

    if (!franchise) {
      return undefined;
    }

    return {
      id: String(franchise.id),
      name: franchise.name,
    };
  }

  async getPlatformMappings(gameId: number): Promise<IgdbPlatformRef[]> {
    const game = await this.getGameDetails(gameId);
    return game?.platforms ?? [];
  }

  private async queryGames(query: string): Promise<IgdbGameRecord[]> {
    const rows = await this.query<IgdbApiGame>("games", query);
    return rows.map(mapIgdbGame);
  }

  private async query<T>(endpoint: string, query: string): Promise<T[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": this.config.clientId,
        Authorization: "Bearer ".concat(this.config.accessToken),
        "Content-Type": "text/plain",
      },
      body: query,
    });

    if (!response.ok) {
      throw new Error(`IGDB request failed (${response.status}): ${await response.text()}`);
    }

    return (await response.json()) as T[];
  }
}

export class InMemoryIGDBProvider implements MetadataProvider {
  constructor(private readonly records: IgdbGameRecord[] = demoIgdbRecords) {}

  async searchByTitle(title: string): Promise<IgdbGameRecord[]> {
    const needle = normalizeForMatch(title);
    return this.records.filter((record) => normalizeForMatch(record.title).includes(needle));
  }

  async searchByAlias(alias: string): Promise<IgdbGameRecord[]> {
    const needle = normalizeForMatch(alias);
    return this.records.filter((record) =>
      record.aliases.some((value) => normalizeForMatch(value).includes(needle)),
    );
  }

  async searchByExternalIds(externalIds: ExternalGameIds): Promise<IgdbGameRecord[]> {
    return this.records.filter((record) => hasMatchingExternalId(record.externalIds, externalIds));
  }

  async getGameDetails(gameId: number): Promise<IgdbGameRecord | undefined> {
    return this.records.find((record) => record.id === gameId);
  }

  async getFranchise(franchiseId: string): Promise<IgdbEntityRef | undefined> {
    return this.records.find((record) => record.franchise?.id === franchiseId)?.franchise;
  }

  async getPlatformMappings(gameId: number): Promise<IgdbPlatformRef[]> {
    return (await this.getGameDetails(gameId))?.platforms ?? [];
  }
}

export function mapIgdbPlatformsToSupportedPlatforms(platforms: IgdbPlatformRef[]): PlatformId[] {
  const mapped = new Set<PlatformId>();

  for (const platform of platforms) {
    const resolved = supportedPlatformMap[platform.id];
    if (resolved) {
      mapped.add(resolved);
    }
  }

  return [...mapped];
}

function hasMatchingExternalId(left: ExternalGameIds, right: ExternalGameIds): boolean {
  return (
    (left.igdbId !== undefined && left.igdbId === right.igdbId) ||
    (left.steamAppId !== undefined && left.steamAppId === right.steamAppId) ||
    (left.nintendoTitleId !== undefined && left.nintendoTitleId === right.nintendoTitleId) ||
    (left.giantBombId !== undefined && left.giantBombId === right.giantBombId) ||
    (left.metacriticSlug !== undefined && left.metacriticSlug === right.metacriticSlug)
  );
}

function escapeQueryValue(value: string): string {
  return value.replace(/"/g, String.raw`\"`);
}

interface IgdbApiNamedEntity {
  id: number;
  name: string;
}

interface IgdbApiImage {
  image_id?: string;
  url?: string;
}

interface IgdbApiGame {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number;
  franchises?: IgdbApiNamedEntity[];
  collection?: IgdbApiNamedEntity;
  game_engines?: IgdbApiNamedEntity[];
  involved_companies?: Array<{
    developer?: boolean;
    publisher?: boolean;
    company?: IgdbApiNamedEntity;
  }>;
  genres?: IgdbApiNamedEntity[];
  themes?: IgdbApiNamedEntity[];
  keywords?: IgdbApiNamedEntity[];
  alternative_names?: Array<{ name: string }>;
  cover?: IgdbApiImage;
  screenshots?: IgdbApiImage[];
  external_games?: Array<{ uid?: string; category?: number }>;
  platforms?: IgdbApiNamedEntity[];
}

const gameFieldSelection = [
  "id",
  "name",
  "summary",
  "first_release_date",
  "franchises.id",
  "franchises.name",
  "collection.id",
  "collection.name",
  "genres.name",
  "themes.name",
  "keywords.name",
  "alternative_names.name",
  "involved_companies.developer",
  "involved_companies.publisher",
  "involved_companies.company.name",
  "cover.image_id",
  "cover.url",
  "screenshots.image_id",
  "screenshots.url",
  "external_games.uid",
  "platforms.id",
  "platforms.name",
].join(",");

function mapIgdbGame(game: IgdbApiGame): IgdbGameRecord {
  const developers = game.involved_companies
    ?.filter((company) => company.developer)
    .map((company) => company.company?.name)
    .filter((name): name is string => Boolean(name)) ?? [];

  const publishers = game.involved_companies
    ?.filter((company) => company.publisher)
    .map((company) => company.company?.name)
    .filter((name): name is string => Boolean(name)) ?? [];

  return {
    id: game.id,
    title: game.name,
    summary: game.summary,
    aliases: game.alternative_names?.map((alias) => alias.name) ?? [],
    franchise: game.franchises?.[0]
      ? {
          id: String(game.franchises[0].id),
          name: game.franchises[0].name,
        }
      : undefined,
    series: game.collection
      ? {
          id: String(game.collection.id),
          name: game.collection.name,
        }
      : undefined,
    genres: game.genres?.map((genre) => genre.name) ?? [],
    themes: game.themes?.map((theme) => theme.name) ?? [],
    keywords: game.keywords?.map((keyword) => keyword.name) ?? [],
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
      : undefined,
    developers,
    publishers,
    coverArt: mapImage(game.cover, game.name, "cover art"),
    screenshots: game.screenshots
      ?.map((screenshot, index) => mapImage(screenshot, game.name, `screenshot ${index + 1}`))
      .filter((image): image is { url: string; alt?: string } => Boolean(image)) ?? [],
    externalIds: {
      igdbId: game.id,
      steamAppId: getSteamAppId(game.external_games),
    },
    platforms:
      game.platforms?.map((platform) => ({
        id: platform.id,
        name: platform.name,
      })) ?? [],
    editionLabel: "Standard",
  };
}

function mapImage(
  image: IgdbApiImage | undefined,
  gameName: string,
  label: string,
): { url: string; alt?: string } | undefined {
  if (!image?.url && !image?.image_id) {
    return undefined;
  }

  const url = image.url?.startsWith("http")
    ? image.url
    : `https://images.igdb.com/igdb/image/upload/t_cover_big/${image.image_id}.jpg`;

  return {
    url,
    alt: `${gameName} ${label}`,
  };
}

function getSteamAppId(externalGames: IgdbApiGame["external_games"]): number | undefined {
  const steamReference = externalGames?.find((entry) => entry.uid && entry.category === 1);
  if (!steamReference?.uid) {
    return undefined;
  }

  const parsed = Number.parseInt(steamReference.uid, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export const demoIgdbRecords: IgdbGameRecord[] = [
  {
    id: 4573,
    title: "Persona 4 Golden",
    summary: "Enhanced Persona 4 release with social links and expanded content.",
    aliases: ["P4G", "Persona4Golden"],
    franchise: { id: "persona", name: "Persona" },
    series: { id: "persona-mainline", name: "Persona Mainline" },
    genres: ["RPG"],
    themes: ["School Life", "Mystery"],
    keywords: ["Social Links", "Dungeon Crawler"],
    releaseDate: "2012-06-14",
    developers: ["Atlus"],
    publishers: ["Atlus", "Sega"],
    coverArt: {
      url: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg",
      alt: "Persona 4 Golden cover art",
    },
    screenshots: [
      {
        url: "https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc7persona.jpg",
        alt: "Persona 4 Golden screenshot 1",
      },
    ],
    externalIds: {
      igdbId: 4573,
      steamAppId: 1113000,
      metacriticSlug: "persona-4-golden",
    },
    platforms: [
      { id: 46, name: "PlayStation Vita" },
      { id: 6, name: "PC (Microsoft Windows)" },
    ],
    editionLabel: "Golden",
  },
  {
    id: 10952,
    title: "Yakuza 0",
    summary: "A crime drama prequel in Kamurocho and Sotenbori.",
    aliases: ["Ryū ga Gotoku 0", "Ryu ga Gotoku 0"],
    franchise: { id: "like-a-dragon", name: "Like a Dragon" },
    series: { id: "like-a-dragon-mainline", name: "Like a Dragon Mainline" },
    genres: ["Action", "RPG"],
    themes: ["Crime"],
    keywords: ["Brawler", "Open City"],
    releaseDate: "2015-03-12",
    developers: ["Ryu Ga Gotoku Studio"],
    publishers: ["Sega"],
    coverArt: {
      url: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2mxy.jpg",
      alt: "Yakuza 0 cover art",
    },
    screenshots: [
      {
        url: "https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc7yakuza.jpg",
        alt: "Yakuza 0 screenshot 1",
      },
    ],
    externalIds: {
      igdbId: 10952,
      steamAppId: 638970,
      metacriticSlug: "yakuza-0",
    },
    platforms: [{ id: 6, name: "PC (Microsoft Windows)" }],
    editionLabel: "Standard",
  },
  {
    id: 114795,
    title: "Monster Hunter Rise",
    summary: "Co-op action hunting adventure.",
    aliases: ["MHR"],
    franchise: { id: "monster-hunter", name: "Monster Hunter" },
    series: { id: "monster-hunter-mainline", name: "Monster Hunter Mainline" },
    genres: ["Action", "RPG"],
    themes: ["Fantasy"],
    keywords: ["Hunting", "Crafting"],
    releaseDate: "2021-03-26",
    developers: ["Capcom"],
    publishers: ["Capcom"],
    coverArt: {
      url: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2n5g.jpg",
      alt: "Monster Hunter Rise cover art",
    },
    screenshots: [
      {
        url: "https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc7mhr.jpg",
        alt: "Monster Hunter Rise screenshot 1",
      },
    ],
    externalIds: {
      igdbId: 114795,
      steamAppId: 1446780,
      nintendoTitleId: "0100559011740000",
      metacriticSlug: "monster-hunter-rise",
    },
    platforms: [
      { id: 130, name: "Nintendo Switch" },
      { id: 6, name: "PC (Microsoft Windows)" },
    ],
    editionLabel: "Base Game",
  },
];
