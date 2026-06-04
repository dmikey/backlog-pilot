import type { UserLibraryService } from "@/lib/library/service";
import type { SteamActivityProvider } from "@/lib/activity/steam-activity-provider";
import type { SteamActivityService } from "@/lib/activity/service";
import type { SteamAccountService } from "@/lib/steam/account-service";
import type { SteamCollectionProvider } from "@/lib/steam/collection-provider";
import type { SteamGameMatcher } from "@/lib/steam/game-matcher";
import type {
  SteamSyncStatusRepository,
  SteamUnmatchedGameRepository,
} from "@/lib/steam/repository";
import type {
  SteamOwnedGame,
  SteamSyncStatus,
  UnmatchedSteamGame,
} from "@/lib/steam/types";
import { SteamValidationError } from "@/lib/steam/types";

interface SteamSyncServiceDependencies {
  accountService: SteamAccountService;
  collectionProvider: SteamCollectionProvider;
  activityProvider: SteamActivityProvider;
  activityService: SteamActivityService;
  matcher: SteamGameMatcher;
  libraryService: UserLibraryService;
  syncStatusRepository: SteamSyncStatusRepository;
  unmatchedRepository: SteamUnmatchedGameRepository;
}

export class SteamSyncService {
  constructor(private readonly dependencies: SteamSyncServiceDependencies) {}

  async syncUserLibrary(
    userId: string,
    options: {
      mode?: "manual" | "automatic";
      force?: boolean;
    } = {},
  ) {
    if (!userId.trim()) {
      throw new SteamValidationError("userId is required.");
    }

    const mode = options.mode ?? "manual";
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();

    this.dependencies.syncStatusRepository.upsert({
      userId,
      state: "running",
      mode,
      startedAt,
      gamesImported: 0,
      gamesMatched: 0,
      gamesUnmatched: 0,
      newAcquisitions: 0,
      removedTitles: 0,
      updatedGames: 0,
    });

    try {
      const steamId = this.getConnectedSteamId(userId);
      const ownedGames = await this.dependencies.collectionProvider.getOwnedGames(steamId);
      const existingSteamEntries = this.dependencies.libraryService.listGames(userId, { platform: "steam" });
      const existingByAppId = new Map<string, (typeof existingSteamEntries)[number]>();

      for (const entry of existingSteamEntries) {
        for (const ownership of entry.ownershipRecords) {
          if (ownership.platform === "steam") {
            existingByAppId.set(ownership.platformGameId, entry);
          }
        }
      }

      const seenAppIds = new Set<string>();
      const unmatched: UnmatchedSteamGame[] = [];
      const activitySnapshotsByAppId = new Map(
        (
          await this.dependencies.activityProvider.getPlaytimeSnapshots(steamId)
        ).map((snapshot) => [snapshot.platformGameId, snapshot]),
      );
      const activityUpdates: Parameters<SteamActivityService["upsertActivities"]>[0] = [];

      let gamesMatched = 0;
      let newAcquisitions = 0;
      let updatedGames = 0;

      for (const game of ownedGames) {
        const appId = String(game.appId);
        seenAppIds.add(appId);
        const existing = existingByAppId.get(appId);
        const match = this.dependencies.matcher.match(game);

        if (!match) {
          unmatched.push({
            userId,
            steamAppId: game.appId,
            title: game.title,
            importedAt: startedAt,
          });
          continue;
        }

        gamesMatched += 1;
        if (!existing) {
          newAcquisitions += 1;
        }

        const playtimeHours = convertPlaytimeMinutesToHours(game.totalPlaytimeMinutes);
        const snapshot = activitySnapshotsByAppId.get(appId) ?? {
          platformGameId: appId,
          totalPlaytimeMinutes: game.totalPlaytimeMinutes,
          recentPlaytimeMinutes: game.recentPlaytimeMinutes,
          lastPlayedAt: game.lastPlayedAt,
        };
        const nextStatus = playtimeHours > 0 ? "Active" : "Unplayed";
        const previousPlaytimeHours = existing?.game.playtimeHours ?? 0;
        const previousLastPlayedAt = getExistingLastPlayedAt(existing?.game.metadata);
        const lastPlayedChanged = (previousLastPlayedAt ?? null) !== (game.lastPlayedAt ?? null);

        this.dependencies.libraryService.addGame({
          userId,
          canonicalGameId: match.game.id,
          status: existing?.game.status ?? nextStatus,
          playtimeHours,
          metadata: toSteamMetadata(game, startedAt),
          ownership: {
            platform: "steam",
            platformGameId: appId,
            source: "Steam",
            ownershipType: "Digital",
          },
        });

        if (existing && (previousPlaytimeHours !== playtimeHours || lastPlayedChanged)) {
          updatedGames += 1;
        }

        activityUpdates.push({
          userId,
          canonicalGameId: match.game.id,
          platform: "steam",
          totalPlaytimeMinutes: snapshot.totalPlaytimeMinutes,
          recentPlaytimeMinutes: snapshot.recentPlaytimeMinutes,
          lastPlayedAt: snapshot.lastPlayedAt,
        });
      }

      let removedTitles = 0;

      for (const [appId, existing] of existingByAppId.entries()) {
        if (seenAppIds.has(appId)) {
          continue;
        }

        removedTitles += 1;

        // Keep entries that are also owned on other platforms. Steam-only entries are removed when
        // Steam no longer reports ownership for the app id.
        if (existing.ownershipRecords.every((record) => record.platform === "steam")) {
          this.dependencies.libraryService.removeGame(userId, existing.game.id);
        }
      }

      this.dependencies.unmatchedRepository.replaceByUserId(userId, unmatched);
      await this.dependencies.activityService.upsertActivities(activityUpdates);

      const completedAt = new Date().toISOString();
      const status = this.dependencies.syncStatusRepository.upsert({
        userId,
        state: "completed",
        mode,
        startedAt,
        completedAt,
        lastSyncAt: completedAt,
        gamesImported: ownedGames.length,
        gamesMatched,
        gamesUnmatched: unmatched.length,
        newAcquisitions,
        removedTitles,
        updatedGames,
        durationMs: Date.now() - startedAtMs,
      });

      return {
        ...status,
        unmatched,
      };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const failedStatus: SteamSyncStatus = {
        userId,
        state: "failed",
        mode,
        startedAt,
        completedAt,
        gamesImported: 0,
        gamesMatched: 0,
        gamesUnmatched: 0,
        newAcquisitions: 0,
        removedTitles: 0,
        updatedGames: 0,
        durationMs: Date.now() - startedAtMs,
        error: error instanceof Error ? error.message : "Steam sync failed.",
      };

      this.dependencies.syncStatusRepository.upsert(failedStatus);
      throw error;
    }
  }

  getSyncStatus(userId: string) {
    if (!userId.trim()) {
      throw new SteamValidationError("userId is required.");
    }

    return (
      this.dependencies.syncStatusRepository.getByUserId(userId) ?? {
        userId,
        state: "idle",
        mode: "manual",
        gamesImported: 0,
        gamesMatched: 0,
        gamesUnmatched: 0,
        newAcquisitions: 0,
        removedTitles: 0,
        updatedGames: 0,
      }
    );
  }

  getSteamLibrary(userId: string) {
    if (!userId.trim()) {
      throw new SteamValidationError("userId is required.");
    }

    const games = this.dependencies.libraryService.listGames(userId, { platform: "steam" });
    const recentlyPlayed = games
      .filter((entry) => Boolean(getExistingLastPlayedAt(entry.game.metadata)))
      .sort((left, right) =>
        (getExistingLastPlayedAt(right.game.metadata) ?? "").localeCompare(
          getExistingLastPlayedAt(left.game.metadata) ?? "",
        ),
      );
    const mostPlayed = games.slice().sort((left, right) => right.game.playtimeHours - left.game.playtimeHours);
    const neverPlayed = games.filter((entry) => entry.game.playtimeHours === 0);

    return {
      games,
      mostPlayed,
      recentlyPlayed,
      neverPlayed,
      unmatched: this.dependencies.unmatchedRepository.listByUserId(userId),
    };
  }

  private getConnectedSteamId(userId: string) {
    const status = this.dependencies.accountService.getConnectionStatus(userId);

    if (!status.connected || !status.steamId) {
      throw new SteamValidationError("Steam account must be connected before syncing.");
    }

    return status.steamId;
  }
}

function toSteamMetadata(game: SteamOwnedGame, syncedAt: string) {
  return {
    steam: {
      appId: game.appId,
      title: game.title,
      totalPlaytimeMinutes: game.totalPlaytimeMinutes,
      recentPlaytimeMinutes: game.recentPlaytimeMinutes,
      lastPlayedAt: game.lastPlayedAt,
      icon: game.icon,
      logo: game.logo,
      syncedAt,
    },
  };
}

function convertPlaytimeMinutesToHours(totalPlaytimeMinutes: number) {
  return Math.round((totalPlaytimeMinutes / 60) * 100) / 100;
}

function getExistingLastPlayedAt(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return undefined;
  }

  const steam = metadata.steam;

  if (!steam || typeof steam !== "object") {
    return undefined;
  }

  const value = (steam as { lastPlayedAt?: unknown }).lastPlayedAt;
  return typeof value === "string" ? value : undefined;
}
