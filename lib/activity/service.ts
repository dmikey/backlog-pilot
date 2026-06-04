import type { SupportedLibraryPlatform } from "@/lib/library/types";

import { SteamEngagementEngine } from "@/lib/activity/engagement-engine";
import type {
  ActivityAnalyticsSummary,
  GameActivity,
  GameActivityHistoryPoint,
  GameActivityWithClassification,
  RecommendationActivitySignal,
} from "@/lib/activity/types";

export class ActivityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActivityValidationError";
  }
}

interface UpsertGameActivityInput {
  userId: string;
  canonicalGameId: string;
  platform: SupportedLibraryPlatform;
  totalPlaytimeMinutes: number;
  recentPlaytimeMinutes: number;
  lastPlayedAt?: string;
}

export class SteamActivityService {
  private readonly activitiesByUser = new Map<string, Map<string, GameActivity>>();
  private readonly historyByUser = new Map<string, Map<string, GameActivityHistoryPoint[]>>();

  constructor(private readonly engagementEngine = new SteamEngagementEngine()) {}

  upsertActivities(input: UpsertGameActivityInput[]): GameActivity[] {
    const updated: GameActivity[] = [];

    for (const entry of input) {
      this.assertRequired(entry.userId, "userId");
      this.assertRequired(entry.canonicalGameId, "canonicalGameId");

      const now = new Date().toISOString();
      const activity = this.normalizeActivity(entry, now);
      const key = this.getActivityKey(activity.canonicalGameId, activity.platform);

      const byGame = this.activitiesByUser.get(entry.userId) ?? new Map<string, GameActivity>();
      byGame.set(key, activity);
      this.activitiesByUser.set(entry.userId, byGame);

      const historyByGame = this.historyByUser.get(entry.userId) ?? new Map<string, GameActivityHistoryPoint[]>();
      const existing = historyByGame.get(key) ?? [];
      existing.push({
        totalPlaytimeMinutes: activity.totalPlaytimeMinutes,
        recentPlaytimeMinutes: activity.recentPlaytimeMinutes,
        lastPlayedAt: activity.lastPlayedAt,
        engagementScore: activity.engagementScore,
        recordedAt: now,
      });
      historyByGame.set(key, existing);
      this.historyByUser.set(entry.userId, historyByGame);

      updated.push(activity);
    }

    return updated;
  }

  listForUser(userId: string): GameActivityWithClassification[] {
    this.assertRequired(userId, "userId");

    const activities = [...(this.activitiesByUser.get(userId)?.values() ?? [])];

    return activities
      .map((activity) => ({
        activity,
        classification: this.engagementEngine.classify(activity),
      }))
      .sort((left, right) => compareLexicographically(left.activity.canonicalGameId, right.activity.canonicalGameId));
  }

  getByGame(userId: string, canonicalGameId: string): GameActivityWithClassification | undefined {
    this.assertRequired(userId, "userId");
    this.assertRequired(canonicalGameId, "canonicalGameId");

    return this.listForUser(userId).find((entry) => entry.activity.canonicalGameId === canonicalGameId);
  }

  getRecent(userId: string, limit = 10): GameActivityWithClassification[] {
    return this.listForUser(userId)
      .filter((entry) => Boolean(entry.activity.lastPlayedAt))
      .sort((left, right) =>
        (right.activity.lastPlayedAt ?? "").localeCompare(left.activity.lastPlayedAt ?? ""),
      )
      .slice(0, limit);
  }

  getMostPlayed(userId: string, limit = 10): GameActivityWithClassification[] {
    return this.listForUser(userId)
      .sort(
        (left, right) =>
          right.activity.totalPlaytimeMinutes - left.activity.totalPlaytimeMinutes ||
          compareLexicographically(left.activity.canonicalGameId, right.activity.canonicalGameId),
      )
      .slice(0, limit);
  }

  getDormant(userId: string, limit = 10): GameActivityWithClassification[] {
    return this.listForUser(userId)
      .filter((entry) => entry.classification === "Dormant" || entry.classification === "Abandoned")
      .sort((left, right) => {
        const leftDays = this.engagementEngine.getDaysSinceLastPlayed(left.activity.lastPlayedAt) ?? Number.MAX_SAFE_INTEGER;
        const rightDays =
          this.engagementEngine.getDaysSinceLastPlayed(right.activity.lastPlayedAt) ?? Number.MAX_SAFE_INTEGER;

        return rightDays - leftDays || compareLexicographically(left.activity.canonicalGameId, right.activity.canonicalGameId);
      })
      .slice(0, limit);
  }

  getRecommendationSignals(userId: string): RecommendationActivitySignal[] {
    return this.listForUser(userId)
      .map((entry) => this.engagementEngine.getRecommendationSignals(entry.activity))
      .sort((left, right) => compareLexicographically(left.canonicalGameId, right.canonicalGameId));
  }

  getAnalyticsSummary(userId: string): ActivityAnalyticsSummary {
    const all = this.listForUser(userId);

    const platformUsageDistribution = [...new Set(all.map((entry) => entry.activity.platform))]
      .map((platform) => ({
        platform,
        totalPlaytimeMinutes: all
          .filter((entry) => entry.activity.platform === platform)
          .reduce((sum, entry) => sum + entry.activity.totalPlaytimeMinutes, 0),
      }))
      .sort((left, right) => right.totalPlaytimeMinutes - left.totalPlaytimeMinutes);

    return {
      mostPlayedGames: this.getMostPlayed(userId, 5).map((entry) => entry.activity),
      recentlyPlayedGames: this.getRecent(userId, 5).map((entry) => entry.activity),
      longestDormantGames: this.getDormant(userId, 5).map((entry) => entry.activity),
      activeRotationCandidates: all
        .filter((entry) => entry.classification === "Active" || entry.classification === "Recently Active")
        .sort((left, right) => right.activity.engagementScore - left.activity.engagementScore)
        .slice(0, 5)
        .map((entry) => entry.activity),
      platformUsageDistribution,
    };
  }

  getHistory(userId: string, canonicalGameId: string, platform: SupportedLibraryPlatform) {
    const key = this.getActivityKey(canonicalGameId, platform);
    return this.historyByUser.get(userId)?.get(key) ?? [];
  }

  private normalizeActivity(input: UpsertGameActivityInput, updatedAt: string): GameActivity {
    const totalPlaytimeMinutes = Math.max(0, Math.floor(input.totalPlaytimeMinutes));
    const recentPlaytimeMinutes = Math.max(0, Math.floor(input.recentPlaytimeMinutes));
    const lastPlayedAt = normalizeTimestamp(input.lastPlayedAt);

    return {
      userId: input.userId,
      canonicalGameId: input.canonicalGameId,
      platform: input.platform,
      totalPlaytimeMinutes,
      recentPlaytimeMinutes,
      lastPlayedAt,
      engagementScore: this.engagementEngine.calculateEngagementScore({
        totalPlaytimeMinutes,
        recentPlaytimeMinutes,
        lastPlayedAt,
      }),
      updatedAt,
    };
  }

  private getActivityKey(canonicalGameId: string, platform: SupportedLibraryPlatform) {
    return `${canonicalGameId}:${platform}`;
  }

  private assertRequired(value: string, fieldName: string) {
    if (!value?.trim()) {
      throw new ActivityValidationError(`${fieldName} is required.`);
    }
  }
}

function compareLexicographically(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
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
