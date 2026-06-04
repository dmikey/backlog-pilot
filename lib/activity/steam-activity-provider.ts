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
      totalPlaytimeMinutes: Math.max(0, Math.floor(game.totalPlaytimeMinutes)),
      recentPlaytimeMinutes: Math.max(0, Math.floor(game.recentPlaytimeMinutes)),
      lastPlayedAt: normalizeTimestamp(game.lastPlayedAt),
    };
  }
}

function normalizeTimestamp(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
}
