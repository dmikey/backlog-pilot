import type {
  ActivityClassification,
  GameActivity,
  RecommendationActivitySignal,
} from "@/lib/activity/types";

const daysPerYear = 365;

export class SteamEngagementEngine {
  calculateEngagementScore(activity: {
    totalPlaytimeMinutes: number;
    recentPlaytimeMinutes: number;
    lastPlayedAt?: string;
  }): number {
    const totalComponent = clamp(
      Math.log1p(Math.max(activity.totalPlaytimeMinutes, 0)) / Math.log1p(6000),
      0,
      1,
    );
    const recentComponent = clamp(Math.max(activity.recentPlaytimeMinutes, 0) / 600, 0, 1);
    const recencyDays = this.getDaysSinceLastPlayed(activity.lastPlayedAt);
    const recencyComponent =
      recencyDays === undefined ? 0 : clamp(1 - recencyDays / daysPerYear, 0, 1);

    return roundToFour(totalComponent * 0.35 + recentComponent * 0.45 + recencyComponent * 0.2);
  }

  classify(activity: {
    totalPlaytimeMinutes: number;
    recentPlaytimeMinutes: number;
    lastPlayedAt?: string;
  }): ActivityClassification {
    const daysSinceLastPlayed = this.getDaysSinceLastPlayed(activity.lastPlayedAt);

    if (daysSinceLastPlayed !== undefined && daysSinceLastPlayed <= 7) {
      return "Active";
    }

    if (daysSinceLastPlayed !== undefined && daysSinceLastPlayed <= 30) {
      return "Recently Active";
    }

    if (
      activity.totalPlaytimeMinutes >= 1800 &&
      (daysSinceLastPlayed === undefined || daysSinceLastPlayed > 30)
    ) {
      return "Completed Candidate";
    }

    if (
      activity.totalPlaytimeMinutes <= 180 &&
      (daysSinceLastPlayed === undefined || daysSinceLastPlayed >= 90)
    ) {
      return "Abandoned";
    }

    if (daysSinceLastPlayed === undefined || daysSinceLastPlayed >= 180) {
      return "Dormant";
    }

    return "Recently Active";
  }

  getRecommendationSignals(activity: GameActivity): RecommendationActivitySignal {
    const daysSinceLastPlayed = this.getDaysSinceLastPlayed(activity.lastPlayedAt);
    const classification = this.classify(activity);
    const engagementScore = this.calculateEngagementScore(activity);

    const recentlyPlayedBoost =
      daysSinceLastPlayed === undefined
        ? 0
        : daysSinceLastPlayed <= 7
          ? 1
          : daysSinceLastPlayed <= 30
            ? 0.65
            : 0;

    const dormantGameBoost =
      daysSinceLastPlayed === undefined || daysSinceLastPlayed < 180
        ? 0
        : roundToFour(clamp(daysSinceLastPlayed / 720, 0.2, 1));

    const activeGameContinuationBonus =
      classification === "Active"
        ? roundToFour(clamp(engagementScore + 0.2, 0, 1))
        : classification === "Recently Active"
          ? 0.3
          : 0;

    const abandonmentRiskScore = roundToFour(
      clamp(
        (daysSinceLastPlayed === undefined ? 1 : Math.min(daysSinceLastPlayed / 365, 1)) *
          (activity.totalPlaytimeMinutes <= 240 ? 0.85 : 0.35),
        0,
        1,
      ),
    );

    return {
      canonicalGameId: activity.canonicalGameId,
      recentlyPlayedBoost,
      dormantGameBoost,
      activeGameContinuationBonus,
      abandonmentRiskScore,
      engagementScore,
      classification,
    };
  }

  getDaysSinceLastPlayed(lastPlayedAt: string | undefined, now = Date.now()): number | undefined {
    if (!lastPlayedAt) {
      return undefined;
    }

    const parsed = Date.parse(lastPlayedAt);

    if (!Number.isFinite(parsed)) {
      return undefined;
    }

    const elapsedMs = Math.max(0, now - parsed);
    return Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}
