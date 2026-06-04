import type { SteamConfig, SteamOwnedGame } from "@/lib/steam/types";
import { SteamValidationError } from "@/lib/steam/types";

interface SteamCollectionProviderDependencies {
  config: SteamConfig;
  fetchImpl?: typeof fetch;
}

interface SteamOwnedGamesResponse {
  response?: {
    games?: SteamOwnedGamePayload[];
  };
}

interface SteamOwnedGamePayload {
  appid?: number;
  name?: string;
  playtime_forever?: number;
  playtime_2weeks?: number;
  rtime_last_played?: number;
  img_icon_url?: string;
  img_logo_url?: string;
}

export class SteamCollectionProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly dependencies: SteamCollectionProviderDependencies) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async getOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
    if (!steamId.trim()) {
      throw new SteamValidationError("steamId is required.");
    }

    const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
    url.searchParams.set("key", this.dependencies.config.apiKey);
    url.searchParams.set("steamid", steamId);
    url.searchParams.set("include_appinfo", "true");
    url.searchParams.set("include_played_free_games", "true");

    const response = await this.fetchImpl(url, { method: "GET" });

    if (!response.ok) {
      throw new SteamValidationError(`Steam library request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as SteamOwnedGamesResponse;
    const games = payload.response?.games ?? [];

    return games
      .filter(isCompleteOwnedGamePayload)
      .map((game) => normalizeSteamOwnedGame(game))
      .sort((left, right) => left.title.localeCompare(right.title));
  }
}

function normalizeSteamOwnedGame(
  game: SteamOwnedGamePayload & {
    appid: number;
    name: string;
  },
): SteamOwnedGame {
  return {
    appId: game.appid,
    title: game.name.trim(),
    totalPlaytimeMinutes: Math.max(0, Math.floor(game.playtime_forever ?? 0)),
    recentPlaytimeMinutes: Math.max(0, Math.floor(game.playtime_2weeks ?? 0)),
    lastPlayedAt:
      typeof game.rtime_last_played === "number" && game.rtime_last_played > 0
        ? new Date(game.rtime_last_played * 1000).toISOString()
        : undefined,
    icon: normalizeImageHash(game.img_icon_url),
    logo: normalizeImageHash(game.img_logo_url),
  };
}

function normalizeImageHash(value: string | undefined) {
  if (!value || !value.trim()) {
    return undefined;
  }

  return value.trim();
}

function isCompleteOwnedGamePayload(
  game: SteamOwnedGamePayload,
): game is SteamOwnedGamePayload & { appid: number; name: string } {
  return typeof game.appid === "number" && typeof game.name === "string";
}
