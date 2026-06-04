import type { SteamCollectionProvider } from "@/lib/steam/collection-provider";
import type { SteamOwnedGame } from "@/lib/steam/types";
import { SteamValidationError } from "@/lib/steam/types";

import type { SteamPlaytimeSnapshot } from "@/lib/activity/types";

export class SteamActivityProvider {
  constructor(private readonly collectionProvider: SteamCollectionProvider) {}

  async getPlaytimeSnapshots(steamId: string): Promise<SteamPlaytimeSnapshot[]> {
    if (!steamId.trim()) {
      throw new SteamValidationError("steamId is required.");
    }

    const games = await this.collectionProvider.getOwnedGames(steamId);

    return games
      .map((game) => this.normalizeOwnedGame(game))
      .sort((left, right) => left.platformGameId.localeCompare(right.platformGameId));
  }

  normalizeOwnedGame(game: SteamOwnedGame): SteamPlaytimeSnapshot {
    return {
      platformGameId: String(game.appId),
      totalPlaytimeMinutes: game.totalPlaytimeMinutes,
      recentPlaytimeMinutes: game.recentPlaytimeMinutes,
      lastPlayedAt: game.lastPlayedAt,
    };
  }
}
