import type { SteamConfig } from "@/lib/steam/types";
import { SteamValidationError } from "@/lib/steam/types";

export interface SteamAchievementSnapshot {
  platformGameId: string;
  totalAchievements: number;
  unlockedAchievements: number;
  progressAvailable: boolean;
}

interface SteamAchievementProviderDependencies {
  config: SteamConfig;
  fetchImpl?: typeof fetch;
}

interface SteamSchemaResponse {
  game?: {
    availableGameStats?: {
      achievements?: Array<{ name?: string }>;
    };
  };
}

interface SteamPlayerAchievementsResponse {
  playerstats?: {
    success?: boolean;
    achievements?: Array<{ achieved?: number }>;
  };
}

export class SteamAchievementProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly dependencies: SteamAchievementProviderDependencies) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async getAchievementSnapshots(steamId: string, appIds: number[]): Promise<SteamAchievementSnapshot[]> {
    if (!steamId.trim()) {
      throw new SteamValidationError("steamId is required.");
    }

    const snapshots = await Promise.all(
      appIds.map((appId) => this.getAchievementSnapshot(steamId, appId)),
    );

    return snapshots
      .filter((entry): entry is SteamAchievementSnapshot => Boolean(entry))
      .sort((left, right) => left.platformGameId.localeCompare(right.platformGameId));
  }

  private async getAchievementSnapshot(
    steamId: string,
    appId: number,
  ): Promise<SteamAchievementSnapshot | undefined> {
    const totalAchievements = await this.getTotalAchievements(appId);

    if (totalAchievements === undefined) {
      return undefined;
    }

    if (totalAchievements === 0) {
      return {
        platformGameId: String(appId),
        totalAchievements: 0,
        unlockedAchievements: 0,
        progressAvailable: true,
      };
    }

    const unlockedAchievements = await this.getUnlockedAchievements(steamId, appId, totalAchievements);

    return {
      platformGameId: String(appId),
      totalAchievements,
      unlockedAchievements: unlockedAchievements ?? 0,
      progressAvailable: unlockedAchievements !== undefined,
    };
  }

  private async getTotalAchievements(appId: number) {
    const url = new URL("https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/");
    url.searchParams.set("key", this.dependencies.config.apiKey);
    url.searchParams.set("appid", String(appId));

    const response = await this.fetchImpl(url, { method: "GET" });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as SteamSchemaResponse;
    return payload.game?.availableGameStats?.achievements?.length ?? 0;
  }

  private async getUnlockedAchievements(
    steamId: string,
    appId: number,
    totalAchievements: number,
  ) {
    const url = new URL("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/");
    url.searchParams.set("key", this.dependencies.config.apiKey);
    url.searchParams.set("steamid", steamId);
    url.searchParams.set("appid", String(appId));

    const response = await this.fetchImpl(url, { method: "GET" });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as SteamPlayerAchievementsResponse;
    const playerStats = payload.playerstats;

    if (!playerStats?.success) {
      return undefined;
    }

    const unlocked = (playerStats.achievements ?? []).filter((entry) => entry.achieved === 1).length;
    return Math.min(unlocked, totalAchievements);
  }
}
