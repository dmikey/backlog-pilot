import type { AchievementService } from "@/lib/achievements/service";
import type { AchievementProgress, AchievementAnalyticsSummary } from "@/lib/achievements/types";
import type { RetroAchievementsProvider } from "@/lib/retroachievements/provider";
import { RetroMasteryEngine } from "@/lib/retroachievements/mastery-engine";
import type { RetroAchievementsUserProfile, RetroAchievementGameProgress } from "@/lib/retroachievements/types";
import { RetroAchievementsValidationError } from "@/lib/retroachievements/types";

export interface RetroSyncResult {
  userId: string;
  username: string;
  syncedGames: number;
  skippedGames: number;
  profile: RetroAchievementsUserProfile;
}

export interface RetroAchievementProgressEntry {
  userId: string;
  canonicalGameId: string;
  retroAchievementsGameId: number;
  gameTitle: string;
  platform: string;
  consoleName: string;
  totalAchievements: number;
  unlockedAchievements: number;
  hardcoreUnlockedAchievements: number;
  completionPercentage: number;
  hardcoreCompletionPercentage: number;
  masteryStatus: string;
  updatedAt: string;
}

interface RetroAchievementServiceDependencies {
  provider: RetroAchievementsProvider;
  achievementService: AchievementService;
  masteryEngine?: RetroMasteryEngine;
  /** Map RA game ID to canonical game ID. For test injection. */
  canonicalGameResolver?: (retroGameId: number, gameTitle: string) => string | undefined;
}

/**
 * RetroAchievementService orchestrates achievement import from RetroAchievements.
 * It fetches user progress from the provider, maps games to canonical IDs,
 * and stores progress via the shared AchievementService.
 */
export class RetroAchievementService {
  private readonly masteryEngine: RetroMasteryEngine;
  private readonly rawProgressByUser = new Map<string, RetroAchievementGameProgress[]>();

  constructor(private readonly dependencies: RetroAchievementServiceDependencies) {
    this.masteryEngine = dependencies.masteryEngine ?? new RetroMasteryEngine();
  }

  /**
   * Sync a user's RetroAchievements progress.
   * Fetches all completion progress for the RA username, maps supported platforms,
   * and upserts into the shared AchievementService.
   */
  async syncUser(userId: string, raUsername: string): Promise<RetroSyncResult> {
    this.assertRequired(userId, "userId");
    this.assertRequired(raUsername, "raUsername");

    const profile = await this.dependencies.provider.getUserProfile(raUsername);
    const allProgress = await this.dependencies.provider.getUserCompletionProgress(raUsername);

    this.rawProgressByUser.set(userId, allProgress);

    const progressUpdates: Parameters<AchievementService["upsertProgress"]>[0] = [];
    let skippedGames = 0;

    for (const entry of allProgress) {
      const platform = this.masteryEngine.toPlatform(entry.consoleId);

      if (!platform) {
        skippedGames += 1;
        continue;
      }

      const canonicalGameId = this.resolveCanonicalGameId(entry);

      if (!canonicalGameId) {
        skippedGames += 1;
        continue;
      }

      progressUpdates.push({
        userId,
        canonicalGameId,
        platform,
        totalAchievements: entry.totalAchievements,
        unlockedAchievements: entry.numAwardedToUser,
      });
    }

    await this.dependencies.achievementService.upsertProgress(progressUpdates);

    return {
      userId,
      username: raUsername,
      syncedGames: progressUpdates.length,
      skippedGames,
      profile,
    };
  }

  /**
   * Get all achievement progress for a user, enriched with retro-specific metadata.
   */
  getProgress(userId: string): RetroAchievementProgressEntry[] {
    this.assertRequired(userId, "userId");

    const rawProgress = this.rawProgressByUser.get(userId) ?? [];
    const normalizedProgress = this.dependencies.achievementService.listForUser(userId);
    const normalizedByGameId = new Map(normalizedProgress.map((p) => [p.canonicalGameId, p]));

    return rawProgress
      .filter((entry) => this.masteryEngine.isSupportedPlatform(entry.consoleId))
      .map((entry) => {
        const canonicalGameId = this.resolveCanonicalGameId(entry);
        const normalized = canonicalGameId ? normalizedByGameId.get(canonicalGameId) : undefined;
        const platform = this.masteryEngine.toPlatform(entry.consoleId);
        const signals = this.masteryEngine.toRetroProgressSignals(entry);

        return {
          userId,
          canonicalGameId: canonicalGameId ?? `ra:${entry.retroAchievementsGameId}`,
          retroAchievementsGameId: entry.retroAchievementsGameId,
          gameTitle: entry.gameTitle,
          platform: platform ?? entry.consoleName,
          consoleName: entry.consoleName,
          totalAchievements: entry.totalAchievements,
          unlockedAchievements: entry.numAwardedToUser,
          hardcoreUnlockedAchievements: entry.numAwardedToUserHardcore,
          completionPercentage: signals.retroCompletionPercentage,
          hardcoreCompletionPercentage: signals.hardcoreCompletionPercentage,
          masteryStatus: normalized?.masteryStatus ?? "Not Started",
          updatedAt: normalized?.updatedAt ?? new Date().toISOString(),
        };
      })
      .sort((a, b) => b.completionPercentage - a.completionPercentage);
  }

  /**
   * Get mastered games (100% completion) for a user.
   */
  getMastered(userId: string): AchievementProgress[] {
    return this.dependencies.achievementService
      .getMastered(userId)
      .filter((p) => isRetroPlatform(p.platform));
  }

  /**
   * Get near-completion games (85–99%) for a user.
   */
  getNearCompletion(userId: string): AchievementProgress[] {
    return this.dependencies.achievementService
      .getNearCompletion(userId)
      .filter((p) => isRetroPlatform(p.platform));
  }

  /**
   * Get analytics summary scoped to retro platforms.
   */
  getAnalytics(userId: string): AchievementAnalyticsSummary {
    const fullSummary = this.dependencies.achievementService.getAnalyticsSummary(userId);

    return {
      mostCompletedGames: fullSummary.mostCompletedGames.filter((p) => isRetroPlatform(p.platform)),
      nearCompletionOpportunities: fullSummary.nearCompletionOpportunities.filter((p) =>
        isRetroPlatform(p.platform),
      ),
      franchiseCompletionOpportunities: fullSummary.franchiseCompletionOpportunities,
      masteredGames: fullSummary.masteredGames.filter((p) => isRetroPlatform(p.platform)),
      achievementEngagementRankings: fullSummary.achievementEngagementRankings,
    };
  }

  private resolveCanonicalGameId(entry: RetroAchievementGameProgress): string | undefined {
    if (this.dependencies.canonicalGameResolver) {
      return this.dependencies.canonicalGameResolver(entry.retroAchievementsGameId, entry.gameTitle);
    }

    return resolveCanonicalGameIdFromTitle(entry.gameTitle);
  }

  private assertRequired(value: string, fieldName: string) {
    if (!value?.trim()) {
      throw new RetroAchievementsValidationError(`${fieldName} is required.`);
    }
  }
}

/**
 * Default canonical game ID resolver — normalizes a title into a canonical slug.
 * This matches the naming convention used for demo-data game IDs.
 * In production, this would be backed by a proper game matching service.
 */
function resolveCanonicalGameIdFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `game-${slug}`;
}

/**
 * Retro platforms are all supported platforms that are NOT modern storefronts.
 */
const modernPlatforms = new Set(["steam", "nintendo-switch"]);

function isRetroPlatform(platform: string): boolean {
  return !modernPlatforms.has(platform);
}
